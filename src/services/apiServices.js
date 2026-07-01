import apiClient from "./apiClient";
import { API_ENDPOINTS } from "../constants";

export const apiServices = {
  login: async (username, password) => {
    const { data, status } = await apiClient.post(API_ENDPOINTS.AUTH.LOGIN, {
      username: username.toLowerCase().trim(),
      password: password,
    });
    return { data: data.data, status };
  },
  logout: async () => {
    await apiClient.post(API_ENDPOINTS.AUTH.LOGOUT);
  },
  materialList: async () => {
    const { data, status } = await apiClient.get(
      API_ENDPOINTS.MATERIAL.GET_MATERIAL_LIST,
    );
    return { data: data.data, status };
  },
  isOnline: async () => {
    const response = await apiClient.get(API_ENDPOINTS.AUTH.IS_ONLINE, {
      timeout: 2000,
    });
    return response.data.isOnline;
  },
  postTransaction: async (payload) => {
    const response = await apiClient.post(
      API_ENDPOINTS.TRANSACTION.POST_TRANSACTION,
      payload,
    );
    return response;
  },
  latestReceiptNumber: async () => {
    const response = await apiClient.get(
      API_ENDPOINTS.TRANSACTION.GET_LATEST_RECEIPT_NUM,
    );
    return response.data;
  },
  postVoidRequest: async (transactionId, reason) => {
    const response = await apiClient.post(
      API_ENDPOINTS.VOID_REQUEST.POST_VOID_REQUEST,
      {
        transactionId,
        reason,
      },
    );
    return response;
  },
};
