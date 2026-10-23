/** Plan entitlements (docs/09 decision 5): 1 career free, 5 with a one-time licence. */
export type Plan = 'free' | 'licensed';
export interface Entitlements {
  readonly plan: Plan;
  readonly maxCareers: number;
  readonly anyClub: boolean;
}
export interface EntitlementsPort {
  forUser(userId: string): Promise<Entitlements>;
}
export const FREE_ENTITLEMENTS: Entitlements = {
  plan: 'free',
  maxCareers: 1,
  anyClub: false,
};
export const LICENSED_ENTITLEMENTS: Entitlements = {
  plan: 'licensed',
  maxCareers: 5,
  anyClub: true,
};

/** Everyone is free unless explicitly licensed. */
export class InMemoryEntitlements implements EntitlementsPort {
  private readonly licensed = new Set<string>();

  public constructor(licensedUserIds: Iterable<string> = []) {
    for (const userId of licensedUserIds) this.licensed.add(userId);
  }

  public license(userId: string): void {
    this.licensed.add(userId);
  }

  public revoke(userId: string): void {
    this.licensed.delete(userId);
  }

  public forUser(userId: string): Promise<Entitlements> {
    return Promise.resolve({
      ...(this.licensed.has(userId)
        ? LICENSED_ENTITLEMENTS
        : FREE_ENTITLEMENTS),
    });
  }
}
