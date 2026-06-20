import { parseCsv } from '../data';

describe('parseCsv', () => {
  it('parses a header row and maps cells by column name', () => {
    const rows = parseCsv('firstName,lastName,email\nGrace,Hopper,grace@navy.mil\nAlan,Turing,alan@bletchley.uk');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ firstName: 'Grace', lastName: 'Hopper', email: 'grace@navy.mil' });
    expect(rows[1].email).toBe('alan@bletchley.uk');
  });

  it('tolerates blank lines and CRLF endings', () => {
    const rows = parseCsv('firstName,email\r\nAda,ada@analytical.engine\r\n\r\n');
    expect(rows).toHaveLength(1);
    expect(rows[0].firstName).toBe('Ada');
  });

  it('returns an empty array for empty input', () => {
    expect(parseCsv('   ')).toEqual([]);
  });
});
