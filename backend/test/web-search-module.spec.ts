import { Test } from '@nestjs/testing';
import { WebSearchModule } from '../src/modules/web-search/web-search.module';
import { WebSearchService } from '../src/modules/web-search/web-search.service';

/**
 * Regression test: WebSearchService must be resolvable by Nest DI.
 * (A constructor-injected `fetch` once broke application startup with
 * "Nest can't resolve dependencies of the WebSearchService".)
 */
it('compiles WebSearchModule and resolves WebSearchService via DI', async () => {
  const mod = await Test.createTestingModule({ imports: [WebSearchModule] }).compile();
  const svc = mod.get(WebSearchService);
  expect(svc).toBeInstanceOf(WebSearchService);
  await mod.close();
});
