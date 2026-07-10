export const ADMIN_REAUTH_REQUIRED_EVENT = 'bersano-admin:reauth-required';

export type AdminReauthRequiredDetail = {
  resolve: (renewed: boolean) => void;
};

let pendingReauth: Promise<boolean> | null = null;

export function requestAdminReauth(): Promise<boolean> {
  if (pendingReauth) {
    return pendingReauth;
  }

  pendingReauth = new Promise<boolean>((resolve) => {
    const done = (renewed: boolean) => {
      resolve(renewed);
    };

    window.dispatchEvent(
      new CustomEvent<AdminReauthRequiredDetail>(ADMIN_REAUTH_REQUIRED_EVENT, {
        detail: { resolve: done },
      })
    );
  }).finally(() => {
    pendingReauth = null;
  });

  return pendingReauth;
}
