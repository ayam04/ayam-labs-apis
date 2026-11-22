/**
 * Test-only ambient declarations.
 *
 * The app tsconfig is Worker-only (no node types), so the fixture is imported
 * through Vite's ?raw loader and this declaration gives it a type.
 */
declare module "*?raw" {
  const content: string;
  export default content;
}
