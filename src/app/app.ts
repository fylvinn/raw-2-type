import { Component, inject, OnInit} from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { JsonParserService } from './core/services/json-parser.service';
import { ShortcutService } from './core/services/shortcut.service';
import {CommonModule} from '@angular/common';

@Component({
  standalone: true,
  selector: 'app-root',
  imports: [CommonModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly parser = inject(JsonParserService);
  protected readonly shortcuts = inject(ShortcutService);

  onInput(event: Event): void {
    const val = (event.target as HTMLTextAreaElement).value;
    this.parser.rawInput.set(val);
  }

  clearInput(): void {
    this.parser.rawInput.set('');
  }

  copyInterfaces(): void {
    const types = this.parser.parseResult().typescriptInterfaces;
    if (types) {
      this.shortcuts.copyToClipboard(types);
    }
  }

  ngOnInit(): void {
    this.shortcuts.registerCopyShortcut(() => {
      const interfaces = this.parser.parseResult().typescriptInterfaces;
      if (interfaces) {
        this.shortcuts.copyToClipboard(interfaces);
      }
    });
  }
}
