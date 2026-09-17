import { WebSearchService } from '../src/modules/web-search/web-search.service';

const OLD_KEY = process.env.SERPER_API_KEY;
beforeEach(() => {
  process.env.SERPER_API_KEY = 'test-key';
});
afterEach(() => {
  if (OLD_KEY === undefined) delete process.env.SERPER_API_KEY;
  else process.env.SERPER_API_KEY = OLD_KEY;
});

function fakeFetchImpl(payload: any, ok = true) {
  return async () =>
    ({ ok, status: ok ? 200 : 500, json: async () => payload }) as any;
}

it('maps serper organic results to WebSource and caps at 8', async () => {
  const organic = Array.from({ length: 10 }, (_, i) => ({
    title: `t${i}`, link: `https://e.com/${i}`, snippet: `s${i}`,
  }));
  const svc = new WebSearchService(fakeFetchImpl({ organic }) as any);
  const out = await svc.search('test query');
  expect(out).toHaveLength(8);
  expect(out[0]).toEqual({ title: 't0', url: 'https://e.com/0', snippet: 's0' });
});

it('throws a clear Persian error when SERPER_API_KEY is missing', async () => {
  const old = process.env.SERPER_API_KEY;
  delete process.env.SERPER_API_KEY;
  const svc = new WebSearchService(fakeFetchImpl({ organic: [] }) as any);
  await expect(svc.search('q')).rejects.toThrow('کلید جستجوی وب تنظیم نشده است');
  process.env.SERPER_API_KEY = old;
});

it('throws on non-https URLs being dropped, keeps https only', async () => {
  const svc = new WebSearchService(
    fakeFetchImpl({ organic: [{ title: 'x', link: 'ftp://e.com/a', snippet: '' }] }) as any,
  );
  await expect(svc.search('q')).resolves.toEqual([]);
});
