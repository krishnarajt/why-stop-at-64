/**
 * Multi-file container format.
 *
 * Layout:
 *   [MAGIC: 4 bytes "MF\x01\x00"]
 *   [FILE_COUNT: 4 bytes LE]
 *   For each file:
 *     [PATH_LEN: 2 bytes LE]
 *     [PATH: N bytes UTF-8]  (relative path, e.g. "folder/file.txt")
 *     [DATA_LEN: 4 bytes LE]
 *     [DATA: M bytes]
 *
 * Used when encoding multiple files. On decode, if fileName === ARCHIVE_SENTINEL,
 * the data field contains this container.
 */

import { CONTAINER_MAGIC, ARCHIVE_SENTINEL } from "./types";

export interface ContainerFile {
  path: string;
  data: Uint8Array;
}

/** Check if raw bytes are a multi-file container. */
export function isContainer(data: Uint8Array): boolean {
  if (data.length < 8) return false;
  for (let i = 0; i < CONTAINER_MAGIC.length; i++) {
    if (data[i] !== CONTAINER_MAGIC[i]) return false;
  }
  return true;
}

/** Bundle multiple files into a single byte blob. */
export function bundleFiles(files: ContainerFile[]): Uint8Array {
  const encoder = new TextEncoder();

  // Calculate total size
  let totalSize = 4 + 4; // magic + count
  for (const f of files) {
    const pathBytes = encoder.encode(f.path);
    totalSize += 2 + pathBytes.length + 4 + f.data.length;
  }

  const result = new Uint8Array(totalSize);
  const view = new DataView(result.buffer);
  let offset = 0;

  // Magic
  result.set(CONTAINER_MAGIC, 0);
  offset += 4;

  // File count
  view.setUint32(offset, files.length, true);
  offset += 4;

  // File entries
  for (const f of files) {
    const pathBytes = encoder.encode(f.path);

    view.setUint16(offset, pathBytes.length, true);
    offset += 2;

    result.set(pathBytes, offset);
    offset += pathBytes.length;

    view.setUint32(offset, f.data.length, true);
    offset += 4;

    result.set(f.data, offset);
    offset += f.data.length;
  }

  return result;
}

/** Unbundle a container blob back into individual files. */
export function unbundleFiles(data: Uint8Array): ContainerFile[] {
  if (!isContainer(data)) {
    throw new Error("Not a valid multi-file container");
  }

  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const decoder = new TextDecoder();
  let offset = 4; // skip magic

  const count = view.getUint32(offset, true);
  offset += 4;

  const files: ContainerFile[] = [];

  for (let i = 0; i < count; i++) {
    const pathLen = view.getUint16(offset, true);
    offset += 2;

    const path = decoder.decode(data.slice(offset, offset + pathLen));
    offset += pathLen;

    const dataLen = view.getUint32(offset, true);
    offset += 4;

    const fileData = data.slice(offset, offset + dataLen);
    offset += dataLen;

    files.push({ path, data: fileData });
  }

  return files;
}

/** Check if a decoded payload is a multi-file archive by its sentinel filename. */
export function isArchive(fileName: string): boolean {
  return fileName === ARCHIVE_SENTINEL;
}
