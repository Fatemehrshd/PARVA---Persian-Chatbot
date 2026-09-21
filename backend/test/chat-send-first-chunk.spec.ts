import { ChatController } from '../src/modules/chat/chat.controller';

function makeReqRes() {
  const written: string[] = [];
  const req: any = {
    user: { sub: 'u1' },
    headers: { accept: 'text/event-stream' },
    on: () => {},
  };
  const res: any = {
    setHeader: () => {},
    writableEnded: false,
    write: (s: string) => {
      written.push(s);
      return true;
    },
    end: () => {},
  };
  return { req, res, written };
}

function fakeChat() {
  return {
    generate: async function* () {
      yield { searchStatus: 'searching' };
      yield { sources: [{ title: 't', url: 'https://e.com', snippet: 's' }] };
      yield { token: 'hi' };
      yield { saved: { id: 'm1' } };
    },
  };
}

it('writes search-status/sources from the first chunk instead of swallowing them', async () => {
  const c = new ChatController(fakeChat() as any);
  const { req, res, written } = makeReqRes();
  await c.send(req, res, 'c1', { content: 'hi', useWebSearch: true });
  const all = written.join('');
  expect(all).toContain('event: search-status');
  expect(all).toContain('event: sources');
  expect(all).toContain('event: token');
  expect(all).toContain('event: done');
});
