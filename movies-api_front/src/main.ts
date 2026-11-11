import { bootstrapApplication } from '@angular/platform-browser';
import { configureBoneyard } from 'boneyard-js/angular';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import './bones/registry';

// Bones are drawn flat and the shimmer comes from the global `.bone` class, so every
// skeleton on the page shares one synchronised sweep (see styles.css).
configureBoneyard({ darkColor: '#1a1724', color: '#1a1724', animate: 'solid', boneClass: 'bone', transition: 250 });

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
