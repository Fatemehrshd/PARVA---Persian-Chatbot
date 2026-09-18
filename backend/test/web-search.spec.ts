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
  const svc = new WebSearchService();
  const out = await svc.search('test query', fakeFetchImpl({ organic }) as any);
  expect(out).toHaveLength(8);
  expect(out[0]).toEqual({ title: 't0', url: 'https://e.com/0', snippet: 's0' });
});

it('throws a clear Persian error when SERPER_API_KEY is missing', async () => {
  const old = process.env.SERPER_API_KEY;
  delete process.env.SERPER_API_KEY;
  const svc = new WebSearchService();
  await expect(svc.search('q', fakeFetchImpl({ organic: [] }) as any)).rejects.toThrow('کلید جستجوی وب تنظیم نشده است');
  process.env.SERPER_API_KEY = old;
});

it('throws on non-https URLs being dropped, keeps https only', async () => {
  const svc = new WebSearchService();
  await expect(
    svc.search('q', fakeFetchImpl({ organic: [{ title: 'x', link: 'ftp://e.com/a', snippet: '' }] }) as any),
  ).resolves.toEqual([]);
});

it('increments the usage counter once per successful search', async () => {
  const queries: any[] = [];
  const repo: any = { query: async (...args: any[]) => { queries.push(args); return []; } };
  const svc = new WebSearchService(repo);
  const out = await svc.search(
    'q',
    fakeFetchImpl({ organic: [{ title: 't', link: 'https://e.com', snippet: 's' }] }) as any,
  );
  expect(out).toHaveLength(1);
  expect(queries).toHaveLength(1);
  expect(queries[0][1]).toEqual(['web_search_used_credits']);
});

it('still returns results when the usage counter fails', async () => {
  const repo: any = { query: async () => { throw new Error('db down'); } };
  const svc = new WebSearchService(repo);
  const out = await svc.search(
    'q',
    fakeFetchImpl({ organic: [{ title: 't', link: 'https://e.com', snippet: 's' }] }) as any,
  );
  expect(out).toHaveLength(1);
});

it('does not count failed searches', async () => {
  const queries: any[] = [];
  const repo: any = { query: async (...args: any[]) => { queries.push(args); return []; } };
  const svc = new WebSearchService(repo);
  await expect(svc.search('q', fakeFetchImpl({}, false) as any)).rejects.toThrow('خطا در سرویس جستجوی وب');
  expect(queries).toHaveLength(0);
});
