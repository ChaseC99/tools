/// <reference lib="webworker" />

import { findTargetQuality } from "./findTargetQuality.mjs";
import { encodeJpegAtQuality, loadJpegSource } from "./workerCodec";
import type { JpgCompressionWorkerRequest, JpgCompressionWorkerResponse } from "./workerProtocol";

type LoadedWorkerSource = {
    baseName: string;
    height: number;
    imageData: ImageData;
    sourceId: number;
    width: number;
};

const workerScope = self as unknown as DedicatedWorkerGlobalScope;

let source: LoadedWorkerSource | null = null;
let latestSourceId = 0;
let latestLoadRequestId = 0;
let latestAutoRequestId = 0;
let latestManualRequestId = 0;

function postMessage(message: JpgCompressionWorkerResponse) {
    workerScope.postMessage(message);
}

function postError(
    stage: "auto-compress" | "load-source" | "manual-compress",
    requestId: number,
    sourceId: number,
    error: unknown,
) {
    postMessage({
        message: error instanceof Error ? error.message : "JPG compression failed.",
        requestId,
        sourceId,
        stage,
        type: "error",
    });
}

async function handleLoadSource(message: Extract<JpgCompressionWorkerRequest, { type: "load-source" }>) {
    latestSourceId = message.sourceId;
    latestLoadRequestId = message.requestId;
    latestAutoRequestId = 0;
    latestManualRequestId = 0;
    source = null;

    try {
        const loaded = await loadJpegSource(message.file);
        if (latestLoadRequestId !== message.requestId || latestSourceId !== message.sourceId) {
            return;
        }

        source = {
            ...loaded,
            sourceId: message.sourceId,
        };

        postMessage({
            baseName: loaded.baseName,
            height: loaded.height,
            requestId: message.requestId,
            sourceId: message.sourceId,
            type: "source-loaded",
            width: loaded.width,
        });
    } catch (error) {
        if (latestLoadRequestId === message.requestId && latestSourceId === message.sourceId) {
            postError("load-source", message.requestId, message.sourceId, error);
        }
    }
}

async function handleAutoCompress(message: Extract<JpgCompressionWorkerRequest, { type: "auto-compress" }>) {
    latestAutoRequestId = message.requestId;

    const activeSource = source;
    if (!activeSource || activeSource.sourceId !== message.sourceId) {
        return;
    }

    try {
        const result = await findTargetQuality(
            {
                maxQuality: message.maxQuality,
                minQuality: message.minQuality,
                targetBytes: message.targetBytes,
            },
            async (quality: number) => encodeJpegAtQuality(activeSource.imageData, quality),
        );

        if (latestAutoRequestId !== message.requestId || source?.sourceId !== message.sourceId) {
            return;
        }

        postMessage({
            requestId: message.requestId,
            result: {
                blob: result.value,
                byteLength: result.value.size,
                metTarget: result.metTarget,
                quality: result.quality,
            },
            sourceId: message.sourceId,
            type: "auto-compressed",
        });
    } catch (error) {
        if (latestAutoRequestId === message.requestId && source?.sourceId === message.sourceId) {
            postError("auto-compress", message.requestId, message.sourceId, error);
        }
    }
}

async function handleManualCompress(message: Extract<JpgCompressionWorkerRequest, { type: "manual-compress" }>) {
    latestManualRequestId = message.requestId;

    const activeSource = source;
    if (!activeSource || activeSource.sourceId !== message.sourceId) {
        return;
    }

    try {
        const blob = await encodeJpegAtQuality(activeSource.imageData, message.quality);
        if (latestManualRequestId !== message.requestId || source?.sourceId !== message.sourceId) {
            return;
        }

        postMessage({
            requestId: message.requestId,
            result: {
                blob,
                byteLength: blob.size,
                metTarget: blob.size <= message.targetBytes,
                quality: message.quality,
            },
            sourceId: message.sourceId,
            type: "manual-compressed",
        });
    } catch (error) {
        if (latestManualRequestId === message.requestId && source?.sourceId === message.sourceId) {
            postError("manual-compress", message.requestId, message.sourceId, error);
        }
    }
}

workerScope.onmessage = (event: MessageEvent<JpgCompressionWorkerRequest>) => {
    const message = event.data;

    switch (message.type) {
        case "load-source":
            void handleLoadSource(message);
            break;
        case "auto-compress":
            void handleAutoCompress(message);
            break;
        case "manual-compress":
            void handleManualCompress(message);
            break;
        default:
            break;
    }
};

export {};
