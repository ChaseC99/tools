export type JpgCompressionWorkerRequest =
    | {
          file: File;
          requestId: number;
          sourceId: number;
          type: "load-source";
      }
    | {
          maxQuality: number;
          minQuality: number;
          requestId: number;
          sourceId: number;
          targetBytes: number;
          type: "auto-compress";
      }
    | {
          quality: number;
          requestId: number;
          sourceId: number;
          targetBytes: number;
          type: "manual-compress";
      };

export type JpgCompressionWorkerResultPayload = {
    blob: Blob;
    byteLength: number;
    metTarget: boolean;
    quality: number;
};

export type JpgCompressionWorkerResponse =
    | {
          baseName: string;
          height: number;
          requestId: number;
          sourceId: number;
          type: "source-loaded";
          width: number;
      }
    | {
          requestId: number;
          result: JpgCompressionWorkerResultPayload;
          sourceId: number;
          type: "auto-compressed";
      }
    | {
          requestId: number;
          result: JpgCompressionWorkerResultPayload;
          sourceId: number;
          type: "manual-compressed";
      }
    | {
          message: string;
          requestId: number;
          sourceId: number;
          stage: "auto-compress" | "load-source" | "manual-compress";
          type: "error";
      };
