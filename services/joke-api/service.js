/**
 * @file service.js
 * @description Joke Service Layer containing business logic for retrieving jokes.
 * It is designed to be agnostic of the underlying database repository.
 */

/**
 * Service class for managing and retrieving jokes.
 */
class JokeService {
    /**
     * Creates an instance of JokeService.
     * @param {Object} repository - The database repository implementation (MySQL or MongoDB).
     */
    constructor(repository) {
        this.repository = repository; 
    }

    /**
     * Retrieves a specified number of random jokes of a given type.
     * @param {string} type - The joke category (e.g., 'programming', 'pun'). Use 'any' for all types.
     * @param {string|number} countStr - The number of jokes to retrieve.
     * @returns {Promise<Array<Object>>} A list of selected joke objects.
     */
    async getRandomJokes(type, countStr) {
        const count = Math.max(1, parseInt(countStr, 10) || 1);
        const isAny = !type || type.toLowerCase() === 'any';
        
        let typeRow = null;

        // 1. Resolve Type Metadata (if specific type requested)
        if (!isAny) {
            typeRow = await this.repository.getTypeByName(type);
            // Edge Case Handled: Return empty array if requested type does not exist
            if (!typeRow) return []; 
        }

        // 2. Discover Boundaries
        const totalJokes = await this.repository.getJokeCount(typeRow);
        if (totalJokes === 0) return [];

        // 3. Compute Unique Random Offsets (Eliminates ORDER BY RAND() bottlenecks)
        const safeCount = Math.min(count, totalJokes); 
        const selectedOffsets = new Set();
        
        while (selectedOffsets.size < safeCount) {
            selectedOffsets.add(Math.floor(Math.random() * totalJokes));
        }

        // 4. Execute Fetch Concurrently
        const jokesPromises = Array.from(selectedOffsets).map(offset => 
            this.repository.getJokeByOffset(typeRow, offset)
        );

        const jokes = await Promise.all(jokesPromises);
        
        // Filter out any unexpected nulls from potential mid-flight DB deletions
        return jokes.filter(joke => joke !== null); 
    }

    /**
     * Retrieves all available joke types.
     * @returns {Promise<Array<string>>} A list of joke types.
     */
    async getTypes() {
        return await this.repository.getTypes();
    }
}

module.exports = JokeService;