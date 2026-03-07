#!/usr/bin/env nu

const ROOT = (path self .. | path expand)
const CONVEX_DIR = (path self ../apps/teleparty-convex | path expand)
const SPACETIME_DIR = (path self ../apps/teleparty-spacetime | path expand)
const CONVEX_ENV_FILE = ($CONVEX_DIR | path join ".env.local")
const SPACETIME_PID_FILE = ($SPACETIME_DIR | path join ".spacetime" "data" "spacetime.pid")

def usage [] {
  print "Nu task runner"
  print ""
  print "Commands:"
  print "  bootstrap"
  print "  convex-backend"
  print "  convex-web"
  print "  convex-dev"
  print "  convex-build"
  print "  spacetime-db"
  print "  spacetime-sync"
  print "  spacetime-web"
  print "  spacetime-dev"
  print "  spacetime-build"
  print "  build-all"
}

def run-in-direnv [cwd: string, ...cmd: string] {
  cd $cwd
  ^direnv exec $ROOT ...$cmd
}

def job-running [job_id: int] {
  (job list | where id == $job_id | length) > 0
}

def safe-job-kill [job_id: int] {
  if $job_id <= 0 {
    return
  }

  if (job-running $job_id) {
    job kill $job_id
  }
}

def convex-env-ready [] {
  if not ($CONVEX_ENV_FILE | path exists) {
    return false
  }

  let env_text = (open --raw $CONVEX_ENV_FILE)
  $env_text | str contains "VITE_CONVEX_URL="
}

def is-spacetime-listening [] {
  let result = (^lsof -iTCP:3010 -sTCP:LISTEN -n -P | complete)
  $result.exit_code == 0
}

def clear-stale-spacetime-pid-lock [] {
  if not ($SPACETIME_PID_FILE | path exists) {
    return
  }

  let stale_pid = (open --raw $SPACETIME_PID_FILE | str trim)
  if ($stale_pid | is-empty) {
    rm -f $SPACETIME_PID_FILE
    return
  }

  let pid_check = (^ps -p $stale_pid | complete)
  if $pid_check.exit_code != 0 {
    rm -f $SPACETIME_PID_FILE
    return
  }

  let command_result = (^ps -p $stale_pid -o command= | complete)
  if $command_result.exit_code == 0 and ($command_result.stdout | str contains "spacetimedb-standalone") {
    ^kill $stale_pid
    sleep 1sec
  }

  rm -f $SPACETIME_PID_FILE
}

def bootstrap [] {
  run-in-direnv $CONVEX_DIR bun install
  run-in-direnv $SPACETIME_DIR bun install
  run-in-direnv ($SPACETIME_DIR | path join "spacetimedb") bun install
}

def convex-backend [] {
  run-in-direnv $CONVEX_DIR bun run convex:dev
}

def convex-web [] {
  run-in-direnv $CONVEX_DIR bun run dev
}

def convex-build [] {
  run-in-direnv $CONVEX_DIR bun run build
}

def convex-dev [] {
  let backend_job = (job spawn --tag "convex-backend" {
    cd $CONVEX_DIR
    ^direnv exec $ROOT bun run convex:dev
  })

  mut ready = false
  for _ in 1..120 {
    if (convex-env-ready) {
      $ready = true
      break
    }

    if not (job-running $backend_job) {
      safe-job-kill $backend_job
      error make { msg: "Convex backend exited before VITE_CONVEX_URL was written." }
    }

    sleep 1sec
  }

  if not $ready {
    safe-job-kill $backend_job
    error make { msg: $"Timed out waiting for Convex to write VITE_CONVEX_URL to ($CONVEX_ENV_FILE)" }
  }

  try {
    run-in-direnv $CONVEX_DIR bun run dev
  } catch {|err|
    safe-job-kill $backend_job
    error make $err
  }

  safe-job-kill $backend_job
}

def spacetime-db [] {
  run-in-direnv $SPACETIME_DIR bun run spacetime:start
}

def spacetime-sync [] {
  run-in-direnv $SPACETIME_DIR bun run spacetime:publish:local
  run-in-direnv $SPACETIME_DIR bun run spacetime:generate
}

def spacetime-web [] {
  run-in-direnv $SPACETIME_DIR bun run dev
}

def spacetime-build [] {
  run-in-direnv $SPACETIME_DIR bun run spacetime:build
  run-in-direnv $SPACETIME_DIR bun run build
}

def spacetime-dev [] {
  mut server_job = 0

  if not (is-spacetime-listening) {
    clear-stale-spacetime-pid-lock

    let started_job = (job spawn --tag "spacetime-db" {
      cd $SPACETIME_DIR
      ^direnv exec $ROOT bun run spacetime:start
    })
    $server_job = $started_job

    mut ready = false
    for _ in 1..30 {
      if (is-spacetime-listening) {
        $ready = true
        break
      }

      if not (job-running $started_job) {
        safe-job-kill $started_job
        error make { msg: "SpacetimeDB exited before port 3010 started listening." }
      }

      sleep 1sec
    }

    if not $ready {
      safe-job-kill $started_job
      error make { msg: "Timed out waiting for SpacetimeDB to start on 127.0.0.1:3010." }
    }
  }

  run-in-direnv $SPACETIME_DIR bun run spacetime:publish:local
  run-in-direnv $SPACETIME_DIR bun run spacetime:generate

  let watch_job = (job spawn --tag "spacetime-watch-server" {
    cd $SPACETIME_DIR
    ^direnv exec $ROOT bun run spacetime:dev:server
  })

  let generate_job = (job spawn --tag "spacetime-generate-watch" {
    cd $SPACETIME_DIR
    watch ($SPACETIME_DIR | path join "spacetimedb" "src") --glob "**/*" --quiet { |_, _, _|
      ^direnv exec $ROOT bun run spacetime:generate
    }
  })

  let active_server_job = $server_job

  try {
    run-in-direnv $SPACETIME_DIR bun run dev
  } catch {|err|
    safe-job-kill $generate_job
    safe-job-kill $watch_job
    safe-job-kill $active_server_job
    error make $err
  }

  safe-job-kill $generate_job
  safe-job-kill $watch_job
  safe-job-kill $active_server_job
}

def build-all [] {
  convex-build
  spacetime-build
}

def main [command?: string] {
  match $command {
    null => { usage }
    "bootstrap" => { bootstrap }
    "convex-backend" => { convex-backend }
    "convex-web" => { convex-web }
    "convex-dev" => { convex-dev }
    "convex-build" => { convex-build }
    "spacetime-db" => { spacetime-db }
    "spacetime-sync" => { spacetime-sync }
    "spacetime-web" => { spacetime-web }
    "spacetime-dev" => { spacetime-dev }
    "spacetime-build" => { spacetime-build }
    "build-all" => { build-all }
    _ => {
      usage
      error make { msg: $"Unknown command: ($command)" }
    }
  }
}
