import { TestBed } from '@angular/core/testing';

import { PageMetaService } from './page-meta.service';

describe('PageMetaService', () => {
  let service: PageMetaService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PageMetaService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
