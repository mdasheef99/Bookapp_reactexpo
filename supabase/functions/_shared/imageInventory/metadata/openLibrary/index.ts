import type {ProviderCapabilityDeclaration} from '../contracts';
import {GOOGLE_BOOKS_CAPABILITY} from '../googleBooks';
export {OpenLibraryEditionOptionsAdapter} from './adapter';
export const OPEN_LIBRARY_CAPABILITY:ProviderCapabilityDeclaration=Object.freeze({
  ...GOOGLE_BOOKS_CAPABILITY,adapterKey:'open_library',adapterVersion:'1.0.0',
  capabilityVersion:'open-library-capability-v1',reusePolicyVersion:'open-library-facts-v1',
});
