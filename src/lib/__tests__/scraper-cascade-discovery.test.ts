import assert from 'node:assert/strict';
import { currentSchoolYear, parseVarsityTeams } from '../scraper/parse-cascade';

function run() {
  // July (month 6) and later belong to the upcoming school year.
  assert.equal(currentSchoolYear(new Date(2026, 6, 27)), '2026-2027', 'late July → new year');
  assert.equal(currentSchoolYear(new Date(2026, 8, 8)), '2026-2027', 'September → same year');
  assert.equal(
    currentSchoolYear(new Date(2027, 0, 16)),
    '2026-2027',
    'January → prior calendar year'
  );
  // Before July belongs to the year that started the previous August.
  assert.equal(currentSchoolYear(new Date(2026, 2, 1)), '2025-2026', 'March → prior school year');

  // A minimal flight payload: one varsity team, one JV team (must be dropped),
  // and one gender-less-displayName varsity team (football).
  const payload = [
    '<script>self.__next_f.push([1,"51:[',
    '{"id":"7866316","displayName":"Girls Varsity Volleyball","homeDescription":null,',
    '"gender":{"id":"2","name":"Girls"},"sport":{"id":"64","name":"Volleyball"},',
    '"level":{"id":"1","name":"Varsity"},"season":{"id":"1","name":"Fall"}},',
    '{"id":"7866317","displayName":"Girls Junior Varsity Volleyball","homeDescription":null,',
    '"gender":{"id":"2","name":"Girls"},"sport":{"id":"64","name":"Volleyball"},',
    '"level":{"id":"2","name":"Junior Varsity"},"season":{"id":"1","name":"Fall"}},',
    '{"id":"7866314","displayName":"Varsity Football","homeDescription":null,',
    '"gender":{"id":"1","name":"Boys"},"sport":{"id":"30","name":"Football"},',
    '"level":{"id":"1","name":"Varsity"},"season":{"id":"1","name":"Fall"}}',
    ']"])</script>',
  ].join('');

  const teams = parseVarsityTeams(payload);
  assert.equal(teams.length, 2, 'only the two varsity teams are kept');

  const vb = teams.find((t) => t.id === '7866316');
  assert.ok(vb, 'volleyball team present');
  assert.equal(vb!.sportLabel, 'Girls Volleyball', 'sportLabel strips "Varsity"');
  assert.equal(vb!.slug, 'girls-volleyball', 'slug from gender + sport');

  const fb = teams.find((t) => t.id === '7866314');
  assert.ok(fb, 'football team present');
  assert.equal(fb!.sportLabel, 'Football', 'football sportLabel');
  assert.equal(fb!.slug, 'boys-football', 'football slug uses payload gender');

  // Regression: a long homeDescription must not push the team's level/gender/sport
  // out of the parse window (a fixed 600-char window previously dropped these,
  // silently losing real teams like Girls Soccer and Football).
  const longDesc = 'x'.repeat(800);
  const withLongDesc = [
    '<script>self.__next_f.push([1,"9:[',
    `{"id":"7866314","displayName":"Varsity Football","homeDescription":"${longDesc}",`,
    '"gender":{"id":"1","name":"Boys"},"sport":{"id":"30","name":"Football"},',
    '"level":{"id":"1","name":"Varsity"},"season":{"id":"1","name":"Fall"}}',
    ']"])</script>',
  ].join('');
  const longTeams = parseVarsityTeams(withLongDesc);
  assert.equal(longTeams.length, 1, 'team with long homeDescription still discovered');
  assert.equal(longTeams[0].slug, 'boys-football', 'slug still derived after long desc');
  assert.equal(longTeams[0].sportLabel, 'Football', 'sportLabel still derived after long desc');

  // The real homepage payload backslash-escapes its quotes (\"id\":\"...\").
  // The parser's optional-backslash tolerance must handle that shape; the
  // fixtures above use plain quotes, so this asserts the escaped case directly.
  const escaped =
    '<script>self.__next_f.push([1,"7:[' +
    '{\\"id\\":\\"7866340\\",\\"displayName\\":\\"Girls Varsity Track\\",\\"homeDescription\\":null,' +
    '\\"gender\\":{\\"id\\":\\"2\\",\\"name\\":\\"Girls\\"},\\"sport\\":{\\"id\\":\\"63\\",\\"name\\":\\"Track\\"},' +
    '\\"level\\":{\\"id\\":\\"1\\",\\"name\\":\\"Varsity\\"}}' +
    ']"])</script>';
  const escapedTeams = parseVarsityTeams(escaped);
  assert.equal(escapedTeams.length, 1, 'parses backslash-escaped payload (real HTML shape)');
  assert.equal(escapedTeams[0].id, '7866340', 'id parsed from escaped payload');
  assert.equal(escapedTeams[0].slug, 'girls-track', 'slug parsed from escaped payload');
  assert.equal(escapedTeams[0].sportLabel, 'Girls Track', 'sportLabel from escaped payload');

  console.log('scraper-cascade-discovery tests passed');
}

run();
