import { Component } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { NgxEditorComponent, NgxEditorMenuComponent, Editor, Toolbar } from 'ngx-editor';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-form-editor',
  imports: [MatCardModule, NgxEditorComponent, NgxEditorMenuComponent, FormsModule],
  templateUrl: './form-editor.component.html'
})
export class AppFormEditorComponent {

  html = '';
  editor: Editor;
  ngOnInit(): void {
    this.editor = new Editor();
  }

  ngOnDestroy(): void {
    this.editor.destroy();
  }

  toolbar: Toolbar = [
    ['bold', 'italic'],
    ['underline'],
    ['ordered_list', 'bullet_list'],
    [{ heading: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'] }],
    ['link', 'image'],
    ['text_color', 'background_color'],
    ['align_left', 'align_center', 'align_right', 'align_justify'],
  ];

  constructor() { }
}
