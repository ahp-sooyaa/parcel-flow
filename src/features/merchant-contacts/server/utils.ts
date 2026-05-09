export function contactDisplayName(contact: { recipientName: string; recipientPhoneNumber: string }) {
  return `${contact.recipientName} (${contact.recipientPhoneNumber})`;
}
