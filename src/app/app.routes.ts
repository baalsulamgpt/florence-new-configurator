import { Routes } from '@angular/router';
import { KonvaConfiguratorComponent } from './features/configurator/components/konva-configurator/konva-configurator.component';
import { NumberingPageComponent } from './features/numbering/components/numbering-page/numbering-page.component';
import { ProjectsPageComponent } from './features/projects/components/projects-page/projects-page.component';

export const routes: Routes = [
    {
      path: '',
      component: ProjectsPageComponent,
      title: 'My Projects'
    },
    {
      path: 'configure',
      component: KonvaConfiguratorComponent,
      title: '4C Configurator'
    },
    {
      path: 'konva',
      component: KonvaConfiguratorComponent,
      title: 'Konva Configurator'
    },
    {
      path: 'numbering',
      component: NumberingPageComponent,
      title: 'Numbering'
    }
];
