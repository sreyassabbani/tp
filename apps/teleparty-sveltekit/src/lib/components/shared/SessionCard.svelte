<script lang="ts">
	import type { SessionProfile } from '$lib/session';

	type SessionCardProps = {
		eyebrow?: string;
		profile: SessionProfile;
		subtitle?: string;
		truncateSecrets?: boolean;
		title: string;
		updateDisplayName: (value: string) => void;
	};

	let {
		eyebrow = 'Presence',
		profile,
		subtitle = '',
		truncateSecrets = true,
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
			maxlength="40"
			oninput={(event) => updateDisplayName((event.currentTarget as HTMLInputElement).value)}
			placeholder="Your room name"
			type="text"
			value={profile.displayName}
		/>
	</label>

	<dl class="session-ledger">
		<div class="session-item">
			<dt>Session</dt>
			<dd><code class="session-code">{profile.sessionId}</code></dd>
		</div>
		<div class="session-item">
			<dt>Host key</dt>
			<dd>
				<code class="session-code">{truncateSecrets ? `${profile.sessionSecret.slice(0, 12)}...` : profile.sessionSecret}</code>
			</dd>
		</div>
		<div class="session-item">
			<dt>Cursor tint</dt>
			<dd class="swatch-row">
				<span class="swatch-dot" style={`--session-color:${profile.color};`}></span>
				<span class="session-label">{profile.color}</span>
			</dd>
		</div>
	</dl>
</section>
