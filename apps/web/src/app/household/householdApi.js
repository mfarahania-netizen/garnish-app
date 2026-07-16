import apiClient from '../../lib/apiClient';

const dataOf = (request) => request.then((response) => response.data);

export const householdApi = {
  listHouseholds: () => dataOf(apiClient.get('/households')),
  getHousehold: (householdId) => dataOf(apiClient.get(`/households/${householdId}`)),
  createHousehold: (name, idempotencyKey) => dataOf(apiClient.post('/households', { name }, {
    headers: { 'Idempotency-Key': idempotencyKey },
  })),

  listPendingInvites: () => dataOf(apiClient.get('/households/invites/pending')),
  inviteMember: (householdId, phone) => dataOf(
    apiClient.post(`/households/${householdId}/invites`, { phone }),
  ),
  listOutgoingInvites: (householdId) => dataOf(
    apiClient.get(`/households/${householdId}/invites`),
  ),
  revokeInvite: (householdId, inviteId) => dataOf(
    apiClient.post(`/households/${householdId}/invites/${inviteId}/revoke`),
  ),
  acceptInvite: (inviteId) => dataOf(apiClient.post(`/households/invites/${inviteId}/accept`)),
  declineInvite: (inviteId) => dataOf(apiClient.post(`/households/invites/${inviteId}/decline`)),

  getShopping: (householdId) => dataOf(apiClient.get(`/households/${householdId}/shopping`)),
  addItem: (householdId, body, idempotencyKey) => dataOf(
    apiClient.post(`/households/${householdId}/shopping/items`, body, {
      headers: { 'Idempotency-Key': idempotencyKey },
    }),
  ),
  updateItem: (householdId, itemId, body) => dataOf(
    apiClient.patch(`/households/${householdId}/shopping/items/${itemId}`, body),
  ),
  removeItem: (householdId, itemId, version) => dataOf(
    apiClient.delete(`/households/${householdId}/shopping/items/${itemId}`, {
      params: { version },
    }),
  ),
  markUnavailable: (householdId, itemId, body) => dataOf(
    apiClient.post(`/households/${householdId}/shopping/items/${itemId}/unavailable`, body),
  ),
  resolveDecision: (householdId, decisionId, body) => dataOf(
    apiClient.post(`/households/${householdId}/shopping/decisions/${decisionId}/resolve`, body),
  ),
  cancelDecision: (householdId, decisionId, version) => dataOf(
    apiClient.post(`/households/${householdId}/shopping/decisions/${decisionId}/cancel`, { version }),
  ),
  startSession: (householdId) => dataOf(
    apiClient.post(`/households/${householdId}/shopping/sessions`, {}),
  ),
  endSession: (householdId, sessionId, version) => dataOf(
    apiClient.post(`/households/${householdId}/shopping/sessions/${sessionId}/end`, { version }),
  ),
  removeMember: (householdId, membershipId, version) => dataOf(
    apiClient.delete(`/households/${householdId}/members/${membershipId}`, {
      params: { version },
    }),
  ),
  leaveHousehold: (householdId, version) => dataOf(
    apiClient.post(`/households/${householdId}/leave`, { version }),
  ),
  transferOwner: (householdId, version, membershipId) => dataOf(
    apiClient.post(`/households/${householdId}/transfer-owner`, { version, membershipId }),
  ),
};

export default householdApi;
