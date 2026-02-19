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

<main>
    <div class="panels">
        <div class="panel panel-input">
            <div class="section-header">
                <label for="json-input">Input</label>
            </div>
            <textarea
                id="json-input"
                bind:value={input}
                placeholder='Paste JSON here...'
                spellcheck="false"
            ></textarea>
        </div>

        <div class="panel">
            <div class="section-header">
                <label for="json-output">Output</label>
                <div class="controls">
                    <select bind:value={indentSize}>
                        <option value={2}>2 spaces</option>
                        <option value={4}>4 spaces</option>
                    </select>
                    <button class="copy-btn" on:click={copyOutput} disabled={!formatted}>
                        {copied ? 'Copied!' : 'Copy'}
                    </button>
                </div>
            </div>
            {#if error}
                <div class="error">{error}</div>
            {:else}
                <div id="json-output" class="output">
                    {#if parsed !== undefined}
                        <JsonNode value={parsed} />
                    {/if}
                </div>
            {/if}
        </div>
    </div>
</main>

<style>
    main {
        padding: 24px 20px;
    }

    .panels {
        display: flex;
        gap: 16px;
        max-width: 1000px;
        margin: 0 auto;
    }

    .panel {
        display: flex;
        flex-direction: column;
        gap: 8px;
        min-width: 0;
        flex: 1;
    }

    .panel-input {
        resize: both;
        overflow: hidden;
        flex: none;
        width: 50%;
        min-width: 150px;
        max-width: 80%;
    }

    label {
        font-weight: bold;
        font-size: 14px;
    }

    textarea {
        width: 100%;
        height: 100%;
        min-height: 400px;
        padding: 12px;
        font-family: monospace;
        font-size: 13px;
        border: 1px solid #ccc;
        border-radius: 8px;
        box-sizing: border-box;
        /* Resize handled by parent */
        resize: none;
    }

    textarea:focus {
        outline: none;
        border-color: #4f8cff;
    }

    .section-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        height: 2rem;
    }

    .controls {
        display: flex;
        gap: 8px;
        align-items: center;
    }

    select {
        padding: 4px 8px;
        border: 1px solid #ccc;
        border-radius: 4px;
        font-size: 13px;
    }

    .copy-btn {
        padding: 4px 12px;
        border: 1px solid #ccc;
        border-radius: 4px;
        background: #fff;
        cursor: pointer;
        font-size: 13px;
    }

    .copy-btn:hover:not(:disabled) {
        background: #f0f0f0;
    }

    .copy-btn:disabled {
        color: #aaa;
        cursor: default;
    }

    .output {
        min-height: 400px;
        padding: 12px;
        font-family: monospace;
        font-size: 13px;
        border: 1px solid #ccc;
        border-radius: 8px;
        background: #fafafa;
        overflow: auto;
        margin: 0;
        white-space: pre;
        box-sizing: border-box;
    }

    .error {
        padding: 12px;
        color: #d00;
        background: #fff0f0;
        border: 1px solid #fcc;
        border-radius: 8px;
        font-size: 13px;
        font-family: monospace;
    }

    @media (max-width: 600px) {
        .panels {
            flex-direction: column;
        }
        .panel-input {
            width: 100%;
            max-width: 100%;
            resize: both;
        }
    }
</style>
