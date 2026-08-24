<script>
    import JsonNode from './JsonNode.svelte';

    let input = '';
    let indentSize = 2;
    let error = '';
    let formatted = '';
    let parsed = undefined;
    let copied = false;

    $: {
        if (input.trim()) {
            try {
                parsed = JSON.parse(input);
                formatted = JSON.stringify(parsed, null, indentSize);
                error = '';
            } catch (e) {
                error = e.message;
                formatted = '';
                parsed = undefined;
            }
        } else {
            formatted = '';
            error = '';
            parsed = undefined;
        }
    }

    async function copyOutput() {
        if (!formatted) return;
        await navigator.clipboard.writeText(formatted);
        copied = true;
        setTimeout(() => copied = false, 1500);
    }
</script>

<section class="json-formatter ui-stack">
    <div class="panels ui-grid ui-grid--two">
        <div class="panel panel-input ui-field">
            <div class="ui-section-header">
                <label class="ui-label" for="json-input">Input</label>
            </div>
            <textarea
                class="ui-textarea ui-code-input"
                id="json-input"
                bind:value={input}
                placeholder='Paste JSON here...'
                spellcheck="false"
            ></textarea>
        </div>

        <div class="panel ui-field">
            <div class="ui-section-header">
                <label class="ui-label" for="json-output">Output</label>
                <div class="controls ui-inline">
                    <select class="ui-select" aria-label="Indent size" bind:value={indentSize}>
                        <option value={2}>2 spaces</option>
                        <option value={4}>4 spaces</option>
                    </select>
                    <button type="button" class="ui-button" data-variant="secondary" data-size="sm" on:click={copyOutput} disabled={!formatted}>
                        {copied ? 'Copied!' : 'Copy'}
                    </button>
                </div>
            </div>
            {#if error}
                <div class="ui-alert" data-variant="danger" role="alert">{error}</div>
            {:else}
                <div id="json-output" class="output ui-code-panel">
                    {#if parsed !== undefined}
                        <JsonNode value={parsed} />
                    {:else}
                        <div class="ui-empty-state">Paste JSON to format and explore it.</div>
                    {/if}
                </div>
            {/if}
        </div>
    </div>
</section>

<style>
    .panels {
        align-items: stretch;
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .panel {
        min-width: 0;
    }

    .panel-input {
        width: 100%;
        max-width: none;
    }

    .panel > .ui-section-header {
        min-height: var(--ui-control-height-md);
    }

    textarea.ui-code-input {
        height: 100%;
        min-height: 400px;
        resize: none;
    }

    .controls {
        display: flex;
        justify-content: flex-end;
        flex-wrap: nowrap;
    }

    .controls .ui-select {
        width: auto;
        min-width: 9rem;
    }

    .output {
        min-height: 400px;
        overflow: auto;
        white-space: pre;
    }

    .output .ui-empty-state {
        white-space: normal;
    }

    @media (max-width: 600px) {
        .panels {
            grid-template-columns: 1fr;
        }

        .panel-input {
            width: 100%;
            max-width: 100%;
        }
    }
</style>
