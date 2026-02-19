<script>
    export let key = undefined;
    export let value;
    export let indent = 0;
    export let last = true;

    let expanded = true;

    $: type = value === null ? 'null'
        : Array.isArray(value) ? 'array'
        : typeof value;

    $: isCollapsible = type === 'object' || type === 'array';
    $: entries = type === 'object' ? Object.entries(value)
        : type === 'array' ? value.map((v, i) => [i, v])
        : [];
    $: openBracket = type === 'array' ? '[' : '{';
    $: closeBracket = type === 'array' ? ']' : '}';
    $: comma = last ? '' : ',';
    $: preview = type === 'array'
        ? `[${value.length}]`
        : `{${Object.keys(value).length}}`;

    function toggle() {
        if (isCollapsible) expanded = !expanded;
    }
</script>

<div class="node" style="padding-left: {indent > 0 ? 16 : 0}px">
    {#if isCollapsible}
        <span class="toggle" on:click={toggle} on:keydown={(e) => e.key === 'Enter' && toggle()} tabindex="0" role="button" aria-expanded={expanded}>
            <span class="arrow" class:collapsed={!expanded}>&#9654;</span>
        </span>
        {#if key !== undefined}
            <span class="json-key">"{key}"</span><span class="colon">: </span>
        {/if}
        {#if expanded}
            <span class="bracket">{openBracket}</span>
            <div class="children">
                {#each entries as [k, v], i}
                    <svelte:self key={type === 'array' ? undefined : k} value={v} indent={1} last={i === entries.length - 1} />
                {/each}
            </div>
            <span class="bracket">{closeBracket}{comma}</span>
        {:else}
            <span class="collapsed-preview" on:click={toggle} on:keydown={(e) => e.key === 'Enter' && toggle()} tabindex="0" role="button">{openBracket}<span class="ellipsis">{preview}</span>{closeBracket}{comma}</span>
        {/if}
    {:else}
        <span class="toggle-spacer"></span>
        {#if key !== undefined}
            <span class="json-key">"{key}"</span><span class="colon">: </span>
        {/if}
        {#if type === 'string'}
            <span class="json-string">"{value}"</span>{comma}
        {:else if type === 'number'}
            <span class="json-number">{value}</span>{comma}
        {:else if type === 'boolean'}
            <span class="json-bool">{value}</span>{comma}
        {:else if type === 'null'}
            <span class="json-null">null</span>{comma}
        {/if}
    {/if}
</div>

<style>
    .node {
        line-height: 1.6;
        white-space: nowrap;
    }

    .toggle {
        display: inline-block;
        width: 14px;
        cursor: pointer;
        user-select: none;
        text-align: center;
        font-size: 8px;
        color: #999;
        vertical-align: middle;
    }

    .toggle:hover {
        color: #333;
    }

    .toggle-spacer {
        display: inline-block;
        width: 14px;
    }

    .arrow {
        display: inline-block;
        transition: transform 0.15s;
    }

    .arrow.collapsed {
        transform: rotate(0deg);
    }

    .arrow:not(.collapsed) {
        transform: rotate(90deg);
    }

    .children {
        /* Indent is handled by child nodes' padding-left */
    }

    .bracket {
        color: #666;
    }

    .colon {
        color: #666;
    }

    .collapsed-preview {
        cursor: pointer;
        color: #666;
    }

    .collapsed-preview:hover {
        background: #f0f0f0;
        border-radius: 3px;
    }

    .ellipsis {
        color: #999;
        font-style: italic;
        font-size: 0.9em;
    }

    .json-key { color: #7c3aed; }
    .json-string { color: #0c0; }
    .json-number { color: #4f8cff; }
    .json-bool { color: #f68e48; }
    .json-null { color: #d00; }
</style>
