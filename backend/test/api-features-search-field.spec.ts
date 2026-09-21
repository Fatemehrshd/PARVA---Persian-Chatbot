import { ApiFeatures } from '../src/shared/api-features';

describe('ApiFeatures search field selection', () => {
  it('restricts search to a validated selected field', () => {
    const result = ApiFeatures.applyToArray(
      [
        { name: 'Alpha', provider: 'OpenAI' },
        { name: 'OpenAI', provider: 'Anthropic' },
      ],
      { search: 'openai', searchField: 'provider' },
      { searchableFields: ['name', 'provider'] },
    );

    expect(result.items).toEqual([{ name: 'Alpha', provider: 'OpenAI' }]);
  });

  it('falls back to all searchable fields for an invalid selected field', () => {
    const result = ApiFeatures.applyToArray(
      [
        { name: 'Alpha', provider: 'OpenAI' },
        { name: 'OpenAI', provider: 'Anthropic' },
      ],
      { search: 'openai', searchField: 'password' },
      { searchableFields: ['name', 'provider'] },
    );

    expect(result.items).toHaveLength(2);
  });
});