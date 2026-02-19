<script>
    import QRCode from 'qrcode';

    let text = '';
    let size = 256;
    let errorLevel = 'M';
    let dataUrl = '';
    let error = '';

    $: {
        if (text.trim()) {
            QRCode.toDataURL(text, {
                width: size,
                errorCorrectionLevel: errorLevel,
                margin: 2,
            }).then((url) => {
                dataUrl = url;
                error = '';
            }).catch((e) => {
                dataUrl = '';
                error = e.message || 'Failed to generate QR code';
            });
        } else {
            dataUrl = '';
            error = '';
        }
    }

    function download() {
        if (!dataUrl) return;
        const link = document.createElement('a');
        link.download = 'qrcode.png';
        link.href = dataUrl;
        link.click();
    }
</script>

<main>
    <div class="card">
        <input
            type="text"
            bind:value={text}
            placeholder="Enter text or URL..."
            class="text-input"
        />

        <div class="options">
            <label>
                Size
                <select bind:value={size}>
                    <option value={128}>128px</option>
                    <option value={256}>256px</option>
                    <option value={512}>512px</option>
                </select>
            </label>
            <label>
                Error Correction
                <select bind:value={errorLevel}>
                    <option value="L">Low</option>
                    <option value="M">Medium</option>
                    <option value="Q">Quartile</option>
                    <option value="H">High</option>
                </select>
            </label>
        </div>

        <div class="preview">
            {#if error}
                <div class="error-msg">{error}</div>
            {:else if dataUrl}
                <img src={dataUrl} alt="QR Code" width={size} height={size} class="qr-image" />
            {:else}
                <div class="placeholder">QR code will appear here</div>
            {/if}
        </div>

        <button class="download-btn" on:click={download} disabled={!dataUrl}>
            Download PNG
        </button>
    </div>
</main>

<style>
    main {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 32px 20px;
    }

    .card {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 20px;
        background: #fff;
        border: 1px solid #e5e7eb;
        border-radius: 16px;
        box-shadow: 0 4px 24px rgba(0, 0, 0, 0.06);
        padding: 2rem;
        width: 100%;
        max-width: 400px;
        box-sizing: border-box;
    }

    .text-input {
        width: 100%;
        padding: 12px;
        font-size: 15px;
        border: 1px solid #ccc;
        border-radius: 8px;
        box-sizing: border-box;
    }

    .text-input:focus {
        outline: none;
        border-color: #4f8cff;
    }

    .options {
        display: flex;
        gap: 16px;
        width: 100%;
        justify-content: center;
    }

    .options label {
        display: flex;
        flex-direction: column;
        gap: 4px;
        font-size: 13px;
        font-weight: bold;
        color: #555;
    }

    .options select {
        padding: 6px 8px;
        border: 1px solid #ccc;
        border-radius: 6px;
        font-size: 13px;
    }

    .preview {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 128px;
    }

    .qr-image {
        max-width: 100%;
        height: auto;
        image-rendering: pixelated;
    }

    .placeholder {
        color: #aaa;
        font-size: 14px;
    }

    .error-msg {
        color: #d00;
        font-size: 13px;
    }

    .download-btn {
        width: 100%;
        padding: 10px;
        border: none;
        border-radius: 10px;
        background: #22c55e;
        color: #fff;
        font-size: 15px;
        font-weight: 600;
        cursor: pointer;
        transition: background 0.2s;
    }

    .download-btn:hover:not(:disabled) {
        background: #16a34a;
    }

    .download-btn:disabled {
        background: #d1d5db;
        cursor: default;
    }

    @media (max-width: 600px) {
        .card {
            padding: 1.25rem;
        }
    }
</style>
