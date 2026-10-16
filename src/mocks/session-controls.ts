import { sessionService } from '@/lib/session/service';
import type { DemoSessionControls } from '@/lib/session/demo';
export const demoSession: DemoSessionControls = {
  async login() {
    await sessionService.login({
      email: 'gustavo@email.com',
      password: 'Gustavo11011',
    });
  },
  logout() {
    void sessionService.logout().catch(() => undefined);
  },
};
