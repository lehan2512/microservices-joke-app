/**
 * Joke Service Layer
 * Houses business logic, routing, and data processing. 
 * Agnostic to which database is currently running.
 */

class JokeService {
    constructor(repository) {
        this.repository = repository; 
    }

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

    async getTypes() {
        return await this.repository.getTypes();
    }
}

module.exports = JokeService;