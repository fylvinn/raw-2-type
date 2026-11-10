import { TestBed } from '@angular/core/testing';
import { DebouncedSignal } from './debounced-signal';

describe('DebouncedSignal', () => {
  let service: DebouncedSignal;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(DebouncedSignal);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
