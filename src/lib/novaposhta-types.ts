/** Shared Nova Poshta directory types (client-safe, no server imports). */

export type NpCity = {
  /** Settlement Ref used to load warehouses. */
  ref: string;
  /** "м. Харків" */
  name: string;
  /** "Харківська обл." / "Лозівський р-н, Харківська обл." */
  hint: string;
  /** Number of Nova Poshta points in the settlement. */
  warehouses: number;
};

export type NpPointKind = "branch" | "postomat" | "dropoff";

/** Weekday schedule exactly as returned by the API ("09:00-18:00" / "Closed"). */
export type NpSchedule = { day: string; hours: string }[];

export type NpPoint = {
  ref: string;
  /** Short label: "Відділення №1" / "Поштомат №5432" */
  name: string;
  number: string;
  /** Street address without the settlement prefix. */
  address: string;
  kind: NpPointKind;
  /** Full API description, city included. */
  description: string;
  /** Warehouse type name from the directory, if provided. */
  typeName: string;
  phone: string;
  /** Max weight of one place / of the whole shipment, kg (0 = not provided). */
  placeMaxWeight: number;
  totalMaxWeight: number;
  schedule: NpSchedule;
  /** Extra services the API reports as available. */
  features: string[];
};

