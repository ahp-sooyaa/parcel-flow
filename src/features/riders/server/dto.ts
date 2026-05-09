export type RiderListItemDto = {
  id: string;
  name: string;
  phoneNumber: string;
  serviceTownships: string[];
  expectedCollection: number;
  actualCollection: number;
  activeParcelCount: number;
};
