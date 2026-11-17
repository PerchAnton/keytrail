import '@angular/compiler';
import { Component } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideAnimations } from '@angular/platform-browser/animations';
import { NzModalModule } from 'ng-zorro-antd/modal';
import 'ng-zorro-antd/ng-zorro-antd.css';
class App { open = false; }
Component({ selector: 'recipe-app', standalone: true, imports: [NzModalModule], template: `
<h1>NG-ZORRO modal</h1><button (click)="open = true">Edit profile</button>
<nz-modal [(nzVisible)]="open" nzTitle="Edit profile" [nzFooter]="null" [nzClosable]="false" [nzNoAnimation]="true" (nzOnCancel)="open = false">
<ng-container *nzModalContent><label>Display name<input cdkFocusInitial value="Ada"></label><button (click)="open = false">Close</button></ng-container>
</nz-modal>` })(App);
document.querySelector('#app').innerHTML = '<recipe-app></recipe-app>';
await bootstrapApplication(App, { providers: [provideAnimations()] });
