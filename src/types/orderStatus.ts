export const ORDER_STATUS = {
  CREATED: 'Created',
  ACKNOWLEDGED: 'Acknowledged',
  PROCESSING: 'Processing',
  COMPLETED: 'Completed',
  REJECTED: 'Rejected',
} as const;

export type OrderStatus = (typeof ORDER_STATUS)[keyof typeof ORDER_STATUS];

export const FINALIZED_ORDER_STATUSES: OrderStatus[] = [
  ORDER_STATUS.ACKNOWLEDGED,
  ORDER_STATUS.PROCESSING,
  ORDER_STATUS.COMPLETED,
];

export const DRIVER_ACTIVE_ORDER_STATUSES: OrderStatus[] = [
  ORDER_STATUS.ACKNOWLEDGED,
  ORDER_STATUS.PROCESSING,
];

export const getDriverStatusLabel = (status: string): string => {
  switch (status) {
    case ORDER_STATUS.ACKNOWLEDGED:
      return 'Accepted';
    case ORDER_STATUS.PROCESSING:
      return 'Picked Up';
    case ORDER_STATUS.COMPLETED:
      return 'Delivered';
    default:
      return status;
  }
};

export const getTrackOrderBadgeClass = (status: string): string => {
  switch (status) {
    case ORDER_STATUS.CREATED:
      return 'bg-gray-300 text-gray-800';
    case ORDER_STATUS.ACKNOWLEDGED:
      return 'bg-blue-500 text-white';
    case ORDER_STATUS.REJECTED:
      return 'bg-red-500 text-white';
    case ORDER_STATUS.PROCESSING:
      return 'bg-yellow-500 text-white';
    case ORDER_STATUS.COMPLETED:
      return 'bg-green-500 text-white';
    default:
      return 'bg-gray-500 text-white';
  }
};

