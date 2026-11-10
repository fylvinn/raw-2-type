import { TestBed } from '@angular/core/testing';
import { JsonParserService } from './json-parser.service';

describe('JsonParserService', () => {
  let service: JsonParserService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(JsonParserService);
  });


  it('merges array object fields and marks absent fields optional', () => {
    const result = service.generateTsInterfaces([
      { id: 1, profile: { name: 'Ada' } },
      { active: true, profile: { name: 'Grace', score: 10 } }
    ], 'RootObject');

    expect(result).toContain('id?: number;');
    expect(result).toContain('active?: boolean;');
    expect(result).toContain('score?: number;');
    expect(result).toContain('export interface RootObjectItem');
  });

  it('infers concrete types alongside null values', () => {
    const result = service.generateTsInterfaces([
      { value: null },
      { value: 'text' }
    ], 'RootObject');

    expect(result).toContain('value: string | null;');
    expect(result).not.toContain('value: any;');
  });

  it('generates unions for mixed primitive arrays', () => {
    const result = service.generateTsInterfaces({
      values: ['text', 42]
    }, 'RootObject');

    expect(result).toContain('values: (string | number)[];');
  });

  it('reuses interfaces with identical shapes and keeps nested names concise', () => {
    const result = service.generateTsInterfaces({
      firstRecord: { label: 'one' },
      secondRecord: { label: 'two' }
    }, 'RootObject');

    expect(result.match(/export interface FirstRecord/g)).toHaveLength(1);
    expect(result).toContain('firstRecord: FirstRecord;');
    expect(result).toContain('secondRecord: FirstRecord;');
  });
});