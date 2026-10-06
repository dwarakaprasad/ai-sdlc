/** A streamed Tutor reply read in full: the text pieces as they arrived, then how the turn ended. */
export type SseTurn = { status: number; reply: string[]; done: unknown; error: unknown };

/** Reads a Server-Sent Events response to the end, collecting its `text`, `done` and `error` events. */
export async function readSse(res: Response): Promise<SseTurn> {
  const body = await res.text();
  const turn: SseTurn = { status: res.status, reply: [], done: undefined, error: undefined };
  if (!res.headers.get("content-type")?.startsWith("text/event-stream")) {
    turn.error = JSON.parse(body);
    return turn;
  }
  for (const block of body.split("\n\n")) {
    const event = /^event: (.*)$/m.exec(block)?.[1];
    const data = /^data: (.*)$/m.exec(block)?.[1];
    if (!event || data === undefined) continue;
    const parsed: unknown = JSON.parse(data);
    if (event === "text") turn.reply.push((parsed as { text: string }).text);
    else if (event === "done") turn.done = parsed;
    else if (event === "error") turn.error = parsed;
  }
  return turn;
}
