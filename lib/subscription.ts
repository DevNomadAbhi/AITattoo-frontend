// Credit management service (API-backed)
import { getCreditsUseCase } from "./tattoo-api";

export interface CreditStatus {
  credits: number;
  proAccessUnlocked: boolean;
}

class SubscriptionService {
  private static instance: SubscriptionService;

  static getInstance(): SubscriptionService {
    if (!SubscriptionService.instance) {
      SubscriptionService.instance = new SubscriptionService();
    }
    return SubscriptionService.instance;
  }

  async getCreditStatus(): Promise<CreditStatus> {
    try {
      const data = await getCreditsUseCase();
      return {
        credits: data.creditsRemaining,
        // Keep existing app behavior: having credits enables gated features.
        proAccessUnlocked: data.creditsRemaining > 0,
      };
    } catch (error) {
      console.error("Failed to load credit status:", error);
      return {
        credits: 0,
        proAccessUnlocked: false,
      };
    }
  }

  async saveCreditStatus(status: CreditStatus): Promise<void> {
    // Credits are server-managed now.
    console.warn("saveCreditStatus is disabled: credits are API-managed.");
  }

  async addCredits(amount: number): Promise<void> {
    // Local credit mutations are intentionally disabled.
    console.warn(
      `addCredits(${amount}) is disabled: credits must be added on backend.`,
    );
  }

  async consumeCredit(): Promise<boolean> {
    // Consumption is handled by backend generation endpoints.
    const status = await this.getCreditStatus();
    return status.credits > 0;
  }

  async unlockProFeatures(): Promise<void> {
    console.warn("unlockProFeatures is disabled: access is API-managed.");
  }

  async getCreditCount(): Promise<number> {
    const status = await this.getCreditStatus();
    return status.credits;
  }

  async hasCredits(): Promise<boolean> {
    const status = await this.getCreditStatus();
    return status.credits > 0;
  }

  // Legacy methods for backward compatibility
  async getSubscriptionStatus(): Promise<any> {
    const creditStatus = await this.getCreditStatus();
    return {
      isSubscribed: creditStatus.credits > 0,
      isTrialActive: false,
    };
  }

  async hasProAccess(): Promise<boolean> {
    try {
      const status = await this.getCreditStatus();
      return status.credits > 0;
    } catch (error) {
      console.error("Failed to check credit-based Pro access:", error);
      return false;
    }

    /*
      Legacy implementation (pre-RevenueCat), preserved by request:

      const status = await this.getCreditStatus();
      // PRO features were available while user had at least one credit.
      return status.credits > 0;
    */
  }

  async getTrialStatusText(): Promise<string> {
    const status = await this.getCreditStatus();
    return `${status.credits} credits remaining`;
  }

  // Check if user can create more tattoos
  async canCreateTattoo(): Promise<{ allowed: boolean; reason?: string }> {
    const hasCredits = await this.hasCredits();
    if (hasCredits) {
      return { allowed: true };
    }

    return {
      allowed: false,
      reason:
        "No credits remaining. Purchase more credits to continue creating tattoos.",
    };
  }

  // Increment creation count for free users (legacy)
  async incrementCreationCount(): Promise<void> {
    // No longer needed with credit system
  }
}

export const subscriptionService = SubscriptionService.getInstance();
