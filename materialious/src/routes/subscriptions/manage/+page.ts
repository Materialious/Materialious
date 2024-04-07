import { getSubscriptions } from "$lib/Api";
import { error } from "@sveltejs/kit";

export async function load() {
  let subscriptions;

  try {
    subscriptions = await getSubscriptions();
  } catch (errorMessage: any) {
    error(500, errorMessage);
  }

  return {
    subscriptions: subscriptions
  };
}