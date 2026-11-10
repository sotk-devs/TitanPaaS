import { describe, it, expect } from '@jest/globals';
import { ProjectVolume } from './project-volume.entity.js';
import { Project } from '../../projects/entities/project.entity.js';

describe('ProjectVolume Entity', () => {
  it('should instantiate a ProjectVolume with all required properties', () => {
    const volume = new ProjectVolume();
    volume.id = 'uuid-vol-1';
    volume.name = 'user-data';
    volume.volumeName = 'titan_vol_proj1_user_data';
    volume.mountPath = '/app/data';
    volume.readOnly = false;
    volume.size = '5GB';
    volume.projectId = 'uuid-proj-1';

    const project = new Project();
    project.id = 'uuid-proj-1';
    project.name = 'my-app';
    volume.project = project;

    expect(volume.id).toBe('uuid-vol-1');
    expect(volume.name).toBe('user-data');
    expect(volume.volumeName).toBe('titan_vol_proj1_user_data');
    expect(volume.mountPath).toBe('/app/data');
    expect(volume.readOnly).toBe(false);
    expect(volume.size).toBe('5GB');
    expect(volume.projectId).toBe('uuid-proj-1');
    expect(volume.project.id).toBe('uuid-proj-1');
  });
});
