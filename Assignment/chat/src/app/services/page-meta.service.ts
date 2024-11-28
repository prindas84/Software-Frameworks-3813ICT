// Angular core modules
import { Injectable } from '@angular/core';

// Angular platform-browser module
import { Title } from '@angular/platform-browser';

@Injectable({
  providedIn: 'root' // This service will be provided in the root level, making it a singleton
})
export class PageMetaService {

  constructor(private titleService: Title) {}

  // Method to set the page title
  setTitle(title: string): void {
    this.titleService.setTitle(title); // Use Angular's Title service to set the document title
  }
}
