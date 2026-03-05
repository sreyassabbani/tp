{
  inputs = {
    # FlakeHub nixpkgs: "0" tracks the current weekly nixpkgs snapshot on FlakeHub
    nixpkgs.url = "https://flakehub.com/f/DeterminateSystems/nixpkgs-weekly/0.tar.gz";

    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs =
    {
      self,
      nixpkgs,
      flake-utils,
    }:
    flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = import nixpkgs { inherit system; };

        spacetimeVersion = "2.0.3";
        spacetimeAsset =
          {
            x86_64-darwin = {
              url = "https://github.com/clockworklabs/SpacetimeDB/releases/download/v${spacetimeVersion}/spacetime-x86_64-apple-darwin.tar.gz";
              hash = "sha256-f8s0YoeJDLBKBHx4WjRZEHAY9T6RiLm28AEI2g9D+jw=";
            };
            aarch64-darwin = {
              url = "https://github.com/clockworklabs/SpacetimeDB/releases/download/v${spacetimeVersion}/spacetime-aarch64-apple-darwin.tar.gz";
              hash = "sha256-kBvCGntOJw9mCahPIDdSZKGvl528cT2CSbkqmd7xk/Q=";
            };
            x86_64-linux = {
              url = "https://github.com/clockworklabs/SpacetimeDB/releases/download/v${spacetimeVersion}/spacetime-x86_64-unknown-linux-gnu.tar.gz";
              hash = "sha256-lS718JaIdWk+R7qieh9YnwjOUKeeHucwOec3+HBA1YY=";
            };
            aarch64-linux = {
              url = "https://github.com/clockworklabs/SpacetimeDB/releases/download/v${spacetimeVersion}/spacetime-aarch64-unknown-linux-gnu.tar.gz";
              hash = "sha256-xHfq+CZssZEwBD6jqUbjEsuOVzsaQJEdn3Tbw/iXTsY=";
            };
          }
          .${system}
            or (throw "Unsupported system for SpacetimeDB CLI: ${system}");

        spacetimeCli = pkgs.stdenvNoCC.mkDerivation {
          pname = "spacetimedb-cli";
          version = spacetimeVersion;

          src = pkgs.fetchurl {
            inherit (spacetimeAsset) url hash;
          };

          sourceRoot = ".";

          nativeBuildInputs = [ pkgs.gnutar ];

          unpackPhase = ''
            runHook preUnpack
            tar -xzf "$src"
            runHook postUnpack
          '';

          installPhase = ''
            runHook preInstall
            mkdir -p "$out/bin"
            install -m755 spacetimedb-cli "$out/bin/spacetime"
            install -m755 spacetimedb-cli "$out/bin/spacetimedb-cli"
            install -m755 spacetimedb-standalone "$out/bin/spacetimedb-standalone"
            runHook postInstall
          '';
        };
      in
      {
        devShells.default = pkgs.mkShell {
          packages = with pkgs; [
            nodejs_24
            bun
            pnpm
            git
            jq
            rustc
            cargo
            spacetimeCli
            gemini-cli
          ];

          shellHook = "
            echo \"Nix dev shell activated\"
            echo \"Node:  $(node --version 2>/dev/null || echo 'not found')\"
            echo \"Bun:   $(bun --version 2>/dev/null || echo 'not found')\"
            echo \"pnpm:  $(pnpm --version 2>/dev/null || echo 'not found')\"
            echo \"spacetime: $(spacetime --version 2>/dev/null || echo 'not found')\"
          ";
        };
      }
    );
}
