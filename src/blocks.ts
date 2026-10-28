/** Internal traversal shared by validation and build-time consumers. */
import type { DocBlock } from "./schema.js";

export function* walkBlocks(blocks: readonly DocBlock[]): Generator<DocBlock> {
    for (const block of blocks) {
        yield block;
        if (block.kind === "tabs") {
            for (const pane of block.panes) yield* walkBlocks(pane.blocks);
        } else if (block.kind === "disclosure") yield* walkBlocks(block.blocks);
    }
}
