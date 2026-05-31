export type ContextBlock = {
  id: string;
  text: string;
  createdAt: string;
};

export type ContextPreset = {
  id: string;
  name: string;
  blockIds: string[];
  isDefault: boolean;
  createdAt: string;
};
