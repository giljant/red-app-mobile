type Guzva = 'niska' | 'umjerena' | 'visoka';

const ČEKANJE: Record<string, [string, string]> = {
  // [umjerena, visoka]
  'Financije':      ['~30 min', '~60+ min'],
  'Pošta':          ['~15 min', '~35 min'],
  'Bolnica':        ['~45 min', '~2h+'],
  'Zdravstvo':      ['~30 min', '~60 min'],
  'Državna služba': ['~25 min', '~50 min'],
  'Banka':          ['~10 min', '~25 min'],
  'Ljekarna':       ['~5 min',  '~12 min'],
  'Promet':         ['~10 min', '~20 min'],
  'Trgovina':       ['~5 min',  '~12 min'],
  'Policija':       ['~20 min', '~45 min'],
};

export function okvirnoČekanje(guzva: Guzva, kategorija: string): string {
  if (guzva === 'niska') return 'Brzo';
  const [umjerena, visoka] = ČEKANJE[kategorija] ?? ['~15 min', '~30+ min'];
  return guzva === 'umjerena' ? umjerena : visoka;
}

export type RadnoVrijeme = {
  pon_pet: string | null;
  subota: string | null;
  nedjelja: string | null;
};

function parseVrijeme(str: string): { h: number; m: number } {
  const [h, m] = str.split(':').map(Number);
  return { h, m };
}

function uMinutama(h: number, m: number) {
  return h * 60 + m;
}

export function jeOtvoreno(rv: RadnoVrijeme): boolean {
  const sada = new Date();
  const dan = sada.getDay(); // 0=ned, 1=pon...6=sub
  const trenutno = uMinutama(sada.getHours(), sada.getMinutes());

  let raspored: string | null = null;
  if (dan === 0) raspored = rv.nedjelja;
  else if (dan === 6) raspored = rv.subota;
  else raspored = rv.pon_pet;

  if (!raspored) return false;

  const [odStr, doStr] = raspored.split('-');
  if (!odStr || !doStr) return false;

  const od = parseVrijeme(odStr);
  const do_ = parseVrijeme(doStr);

  const odMin = uMinutama(od.h, od.m);
  const doMin = do_.h === 0 && do_.m === 0 ? 24 * 60 : uMinutama(do_.h, do_.m);

  // 24h lokacija
  if (odMin === 0 && doMin === 24 * 60) return true;

  return trenutno >= odMin && trenutno < doMin;
}

export function formatRadnoVrijeme(rv: RadnoVrijeme): string {
  const dan = new Date().getDay();
  let raspored: string | null = null;
  let label = '';

  if (dan === 0) { raspored = rv.nedjelja; label = 'Ned'; }
  else if (dan === 6) { raspored = rv.subota; label = 'Sub'; }
  else { raspored = rv.pon_pet; label = 'Pon–Pet'; }

  if (!raspored) return `${label}: zatvoreno`;
  if (raspored === '00:00-24:00') return '24 sata';
  return `${label}: ${raspored}`;
}

export type Svježina = 'svježe' | 'staro' | 'nepoznato';

export function svjezinaStatusa(lastUpdated: string | null): Svježina {
  if (!lastUpdated) return 'nepoznato';
  const diffH = (Date.now() - new Date(lastUpdated).getTime()) / 3600000;
  if (diffH < 1) return 'svježe';
  if (diffH < 3) return 'staro';
  return 'nepoznato';
}

export function svjezinaLabel(lastUpdated: string | null): string {
  if (!lastUpdated) return 'Nepoznato';
  const diffMin = Math.floor((Date.now() - new Date(lastUpdated).getTime()) / 60000);
  if (diffMin < 1) return 'upravo';
  if (diffMin < 60) return `${diffMin} min`;
  const h = Math.floor(diffMin / 60);
  if (h < 3) return `${h}h`;
  return 'Nepoznato';
}

export function formatPotpunoRadnoVrijeme(rv: RadnoVrijeme): string[] {
  const linije: string[] = [];
  if (rv.pon_pet) linije.push(`Pon–Pet: ${rv.pon_pet === '00:00-24:00' ? '0–24h' : rv.pon_pet}`);
  if (rv.subota) linije.push(`Sub: ${rv.subota === '00:00-24:00' ? '0–24h' : rv.subota}`);
  else linije.push('Sub: zatvoreno');
  if (rv.nedjelja) linije.push(`Ned: ${rv.nedjelja === '00:00-24:00' ? '0–24h' : rv.nedjelja}`);
  else linije.push('Ned: zatvoreno');
  return linije;
}
