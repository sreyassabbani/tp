<script lang="ts">
	import type { SessionProfile } from '$lib/session';

	type SessionCardProps = {
		eyebrow?: string;
		profile: SessionProfile;
		subtitle?: string;
		title: string;
		updateDisplayName: (value: string) => void;
	};

	let {
		eyebrow = 'Presence',
		profile,
		subtitle = '',
		title,
		updateDisplayName
	}: SessionCardProps = $props();
</script>

<section class="panel session-card">
	<div class="panel-header">
		<p class="eyebrow">{eyebrow}</p>
		<h2 class="panel-title">{title}</h2>
		{#if subtitle}
			<p class="quiet">{subtitle}</p>
		{/if}
	</div>

	<label class="field session-field">
		<span class="field-label">Display name</span>
		<input
			class="field-input"
			oninput={(event) => updateDisplayName((event.currentTarget as HTMLInputElement).value)}
			type="text"
			value={profile.displayName}
		/>
	</label>

	<dl class="session-ledger">
		<div>
			<dt>Session</dt>
			<dd><code>{profile.sessionId}</code></dd>
		</div>
		<div>
			<dt>Owner key</dt>
			<dd><code>{profile.sessionSecret}</code></dd>
		</div>
		<div>
			<dt>Cursor tint</dt>
			<dd class="swatch-row">
				<span class="swatch-dot" style={`--session-color:${profile.color};`}></span>
				<strong>{profile.color}</strong>
			</dd>
		</div>
	</dl>
</section>

<style>
	.session-card {
		padding: 1.35rem;
	}

	.session-field {
		margin-top: 1rem;
	}

	.session-ledger {
		display: grid;
		gap: 0.82rem;
		margin: 1rem 0 0;
		padding-top: 1rem;
		border-top: 1px solid var(--line-soft);
	}

	.session-ledger div {
		display: grid;
		gap: 0.22rem;
	}

	dt {
		font-size: 0.74rem;
		font-weight: 800;
		letter-spacing: 0.11em;
		text-transform: uppercase;
		color: var(--ink-soft);
	}

	dd {
		margin: 0;
	}

	code {
		overflow-wrap: anywhere;
		font-size: 0.78rem;
	}

	.swatch-row {
		display: inline-flex;
		align-items: center;
		gap: 0.55rem;
	}

	.swatch-dot {
		display: inline-flex;
		height: 0.85rem;
		width: 0.85rem;
		border-radius: 999px;
		background: var(--session-color);
		box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.74);
	}
</style>
