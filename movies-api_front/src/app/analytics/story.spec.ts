import { tell } from './story';

describe('tell', () => {
  it('marks every interpolated value as a data point', () => {
    const n = 4800;
    expect(tell`El catálogo tiene ${n} películas de ${'1916'} a hoy.`).toEqual([
      'El catálogo tiene ', { b: '4800' }, ' películas de ', { b: '1916' }, ' a hoy.',
    ]);
  });

  it('skips empty text around adjacent values', () => {
    expect(tell`${'a'}${'b'}`).toEqual([{ b: 'a' }, { b: 'b' }]);
  });
});
