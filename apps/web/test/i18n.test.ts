import { describe, expect, test } from 'bun:test';
import { DEFAULT_LANG, HINTS, HintBook, LANGS, messages, readLang, translate, writeLang, type Lang, type MsgKey } from '../src/lib/i18n';

/** `Storage` de mentira: um mapa, para o navegador não entrar no teste. */
function fakeStorage(): Storage {
  const m = new Map<string, string>();
  return {
    getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, String(v)), removeItem: (k) => void m.delete(k),
    clear: () => m.clear(), key: (i) => [...m.keys()][i] ?? null, get length() { return m.size; },
  };
}

describe('tabela de tradução', () => {
  test('português é o padrão e o inglês é a outra língua', () => {
    expect(DEFAULT_LANG).toBe('pt');
    expect(LANGS).toEqual(['pt', 'en']);
  });

  test('toda chave existe nas duas línguas, sem texto vazio', () => {
    const keys = Object.keys(messages.pt) as MsgKey[];
    expect(keys.length).toBeGreaterThan(50);
    for (const lang of LANGS) for (const k of keys) expect(messages[lang][k], `${lang}.${k}`).not.toBe('');
    expect(Object.keys(messages.en).sort()).toEqual(keys.slice().sort());
  });

  test('traduz por chave e interpola parâmetros', () => {
    expect(translate('pt', 'home.open')).toBe('Abrir uma sala');
    expect(translate('en', 'home.open')).toBe('Open a room');
    expect(translate('pt', 'log.newHand', { name: 'Zé' })).toBe('Nova mão. Zé é o mão.');
    expect(translate('en', 'log.newHand', { name: 'Zé' })).toContain('Zé');
  });

  test('os dois textos de cada chave usam os mesmos parâmetros', () => {
    const params = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    for (const k of Object.keys(messages.pt) as MsgKey[]) expect(params(messages.en[k]), k).toEqual(params(messages.pt[k]));
  });

  test('as chamadas da mesa e as mãos especiais ficam em português nas duas línguas', () => {
    for (const lang of LANGS as Lang[]) {
      expect(translate(lang, 'log.raise', { name: 'Zé', call: 'TRUCO!', to: 4 })).toContain('TRUCO!');
      expect(translate(lang, 'log.decline', { name: 'Zé', team: 'Eles', value: 2 })).toContain('Corro!');
      expect(translate(lang, 'log.dezHand', { team: 'Eles', value: 4, name: 'Zé' })).toContain('Mão de dez');
      expect(translate(lang, 'log.ferroHand')).toContain('Mão de ferro');
      expect(translate(lang, 'badge.dez')).toBe('mão de dez');
      expect(translate(lang, 'badge.ferro')).toBe('mão de ferro');
      expect(translate(lang, 'say.accept')).toBe('Aceito.');
      expect(translate(lang, 'say.decline')).toBe('Corro!');
    }
  });

  test('a língua é lembrada pelo navegador, com português quando não há nada guardado', () => {
    const store = fakeStorage();
    expect(readLang(store)).toBe('pt');
    writeLang(store, 'en');
    expect(readLang(store)).toBe('en');
    store.setItem('truco.lang', 'klingon');
    expect(readLang(store)).toBe('pt');
  });
});

describe('dicas em inglês', () => {
  test('há uma dica para cada chamada e cada mão especial', () => {
    expect(Object.keys(HINTS).sort()).toEqual(['corro', 'dez', 'doze', 'ferroHand', 'dezHand', 'seis', 'truco'].sort());
    for (const h of Object.values(HINTS)) expect(h.length).toBeGreaterThan(10);
  });

  test('cada dica aparece uma vez só, e o navegador lembra', () => {
    const store = fakeStorage();
    const book = new HintBook(store);
    expect(book.claim('truco')).toBe(true);
    expect(book.claim('truco')).toBe(false);
    expect(book.claim('seis')).toBe(true);
    // outra visita, mesmo navegador
    expect(new HintBook(store).claim('truco')).toBe(false);
    expect(new HintBook(store).claim('corro')).toBe(true);
    // sem storage (modo privado): vale para a aba
    const tab = new HintBook(null);
    expect(tab.claim('truco')).toBe(true);
    expect(tab.claim('truco')).toBe(false);
  });
});
