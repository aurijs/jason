## [1.6.5](https://github.com/aurijs/jason/compare/1.5.3...1.6.5) (2025-03-14)

### chore

- add gitignore files for node and python packages([b180822](https://github.com/aurijs/jason/commit/b1808220eaccbe1376b1b3df2650b4e03b6fc006))
- bump version to 1.5.4 and update author email ✉️([05dc641](https://github.com/aurijs/jason/commit/05dc64129638b8af41ef2953deeea543b4fa8f80))
- update .gitignore to exclude db directory and benchmark files 🗑️([51cee89](https://github.com/aurijs/jason/commit/51cee89a18e7b5e908d621211aa2da797beb18ac))

### ci

- added deploy action([5ca4ef0](https://github.com/aurijs/jason/commit/5ca4ef0fb905c7b766fc4b97784f32e8169b098e))

### refactor

- remove AsyncMutex class as it is no longer needed 🗑️([cf8db74](https://github.com/aurijs/jason/commit/cf8db74fe4c8f468e7ee52c783d4eb5c3dd9705a))

## [1.5.3](https://github.com/aurijs/jason/compare/1.5.0...1.5.3) (2025-02-19)

### chore

- added test for readAll([7f96452](https://github.com/aurijs/jason/commit/7f96452dce94988112c52cea5447eb1eceba1b48))
- update changelog for v1.5.3 and bump version to 1.5.3 📄🔧([eea5691](https://github.com/aurijs/jason/commit/eea5691628637d95798b918b1a01bd369367ecfe))
- update version to 1.5.2 and document changes in CHANGELOG.md 📜✨([974136f](https://github.com/aurijs/jason/commit/974136f05821cee76592c010b3a1809d25580289))

### docs

- fix formatting in README for better readability 📄✨([068765e](https://github.com/aurijs/jason/commit/068765ea480ae9b3e2e5fac7306f1332498d05fc))

### fix

- made readAll() ignore \_metadata file([dc606a5](https://github.com/aurijs/jason/commit/dc606a561138044b65b1da671d9a337069b46430))
- removed redundant sorting in Collection class([9cc42ac](https://github.com/aurijs/jason/commit/9cc42acf09109978071205b27dbffeef64f4c430))
- resolve base path resolution issue in constructor 🔧✨([3be3775](https://github.com/aurijs/jason/commit/3be377530e65d174104080437e008ea03375f5f7))
- simplify temporary prefix in writer.ts 🛠️✨([bc7d72d](https://github.com/aurijs/jason/commit/bc7d72d27c7fc149457391b44141428461ca0726))

### refactor

- remove unused imports in main.ts 🧹✨([d84e60c](https://github.com/aurijs/jason/commit/d84e60c6f8d1753009e1c90b3ef18a8bf2183b47))
- update method visibility to private in Collection class 🔒✨([93ccc04](https://github.com/aurijs/jason/commit/93ccc0400de9c75282725e81a33fba91f9022fc1))

# [1.5.0](https://github.com/aurijs/jason/compare/75bdd2826ed6097275a6324ca91a918103e27f8b...1.5.0) (2025-02-05)

### chore

- add async-mutex and devalue to devDependencies for improved functionality 🔧✨([1f0e691](https://github.com/aurijs/jason/commit/1f0e6912c7bc96f3bb83674cfdbf5c30a255338d))
- add CHANGELOG.md for project documentation 📜✨([2cdfac6](https://github.com/aurijs/jason/commit/2cdfac61e75e7d318d4aff72cbe11c7509ffa4b8))
- add steno as a devDependency for improved file handling([d088d51](https://github.com/aurijs/jason/commit/d088d51c20457a6beb6d5ae86fed5b2c40ae2e63))
- remove benchmark directory and associated files([06cbbdf](https://github.com/aurijs/jason/commit/06cbbdf72a1ae80331deafc983bda4c590f90f23))
- update version to 1.0.2 and add benchmark to .gitignore([b30fe83](https://github.com/aurijs/jason/commit/b30fe83fe0ccda41d9541e813149d1cdab86c0be))
- update version to 1.0.3 and enhance scripts in package.json([c18caaf](https://github.com/aurijs/jason/commit/c18caafb23b0ba80454dc9675d1a4437b775c22b))

### docs

- update README to enhance clarity and add installation instructions([6ef12fb](https://github.com/aurijs/jason/commit/6ef12fb0f9630932a0f2e5801a3a3b5de761fec0))

### feat

- add biome configuration file with linter rules([a0368d2](https://github.com/aurijs/jason/commit/a0368d2cd273910095deb876a548fb8e2161dda1))
- add generateMetadata option to collection and BaseCollections interfaces([3f50bb8](https://github.com/aurijs/jason/commit/3f50bb8dde6adc89d38621395c41e998b519a0a7))
- add type definitions for collections, documents, and query options in JasonDB([f503077](https://github.com/aurijs/jason/commit/f503077fe8635fcc1882ea90234afbe702e6d3a3))
- enhance Cache class with reactive state management for improved item handling and automatic expiration([22c9c58](https://github.com/aurijs/jason/commit/22c9c58ceb3957f3a8fd1f2a4acf9e7587d1e9fd))
- implement reactive proxy and error handling mechanisms for improved state management([c3de09d](https://github.com/aurijs/jason/commit/c3de09d1b7e6cc9465515ae5412fb26d11811d02))
- implement reactive state management in Writer class for improved file handling([34ade03](https://github.com/aurijs/jason/commit/34ade032054e27bda67c562ba1ded27ee235d581))
- implement reactive state management with observers and derived values([dfe2483](https://github.com/aurijs/jason/commit/dfe2483fbc80e83228f46e62d8feb4af40c10098))
- introduce reactive symbols and batch processing for improved state management([c2fc551](https://github.com/aurijs/jason/commit/c2fc551ccb0058b83612b47cb0c13e62a187a2f1))
- update module imports to use .js extensions and add utility functions for async operations([1e8388f](https://github.com/aurijs/jason/commit/1e8388fc0569c00a8114965be87129fe383c9382))

### fix

- address edge case in state management to prevent potential data loss([19704f4](https://github.com/aurijs/jason/commit/19704f47d9d38ea965d3a8184d1e33ff05d0623f))
- update package name to include scope for better organization([69b2ca8](https://github.com/aurijs/jason/commit/69b2ca8670a55c4ac14b3ccf24aed7058f84269c))

### refactor

- clean up collection.ts by removing unused console logs and optimizing cache update 🔄✨([cb8a8c0](https://github.com/aurijs/jason/commit/cb8a8c0f6ff580ab3669f7b3b126a90283502b13))
- clean up test files by removing unused code and optimizing query methods 🔄✨([99983d1](https://github.com/aurijs/jason/commit/99983d1842ad06ab74f7944c5cb0b5cf5b86be7d))
- convert private properties in Collection class to use class fields for improved encapsulation([6a1fe99](https://github.com/aurijs/jason/commit/6a1fe998ec711246ee21a9dfbe46ada034b035b7))
- encapsulate private properties and methods in JasonDB class 🔒✨([0fd2fd6](https://github.com/aurijs/jason/commit/0fd2fd61848811619ad60dbfaeda47fdae651469))
- enhance BaseDocument type for improved flexibility and type safety([ea0e7f4](https://github.com/aurijs/jason/commit/ea0e7f49e7a2ff29ef0859361c1f3954d2186f10))
- enhance cache management with size limits and automatic cleanup 🧹💾([b242c27](https://github.com/aurijs/jason/commit/b242c2795543490e69759d059de4a6ba323ea432))
- enhance cache state management and error handling in collection creation([3dfb672](https://github.com/aurijs/jason/commit/3dfb6722972bf874032efcbf10da93162e28dfe7))
- enhance cache update method to improve entry management and timestamp handling 🔄✨([b53da0b](https://github.com/aurijs/jason/commit/b53da0b9f8b34df7bc46af4fe4cec116b8e2b80e))
- enhance CREATE tests with additional scenarios and error handling 🧪✨([791ba95](https://github.com/aurijs/jason/commit/791ba9529916eca2e1184def1947a437d28bcf63))
- enhance metadata management with improved validation and persistence 🛠️✨([6a87b95](https://github.com/aurijs/jason/commit/6a87b95ace3076c2b4826e351a492fe774c31945))
- enhance query tests with additional scenarios and improve type definitions 🛠️✨([628a74a](https://github.com/aurijs/jason/commit/628a74a8ff8ffe97af3cec2ea4a8f91956fba314))
- enhance read tests with parameterized suite and improve error handling 🛠️✨([4d24022](https://github.com/aurijs/jason/commit/4d24022615aab7bc8a7c8cea21618a754f523a63))
- enhance retry logic and improve temporary file naming strategy 🔄✨([f3b93b5](https://github.com/aurijs/jason/commit/f3b93b5789a7cb0d18b75e3ab030ac471e78e2fb))
- enhance user update tests with full and partial updates, schema validation, and persistence checks 🔄✨([dd1e244](https://github.com/aurijs/jason/commit/dd1e2442bf8f56e7cada6405df8f3711bb2bcf0b))
- improve atomic file writing with queue management and temporary file handling 📝🔧([8472ba0](https://github.com/aurijs/jason/commit/8472ba00ea7e821ed03d4c4c649d596f6f3cbf75))
- improve documentation for write method in Writer class 📝✨([c2af083](https://github.com/aurijs/jason/commit/c2af0831beb22da5843b11e40140731251dace1c))
- improve retryAsyncOperation function with clearer parameters and enhanced error handling 🔄✨([aa5f090](https://github.com/aurijs/jason/commit/aa5f090ec6a1518101f09b3bd5acab4b61f914e3))
- improve test setup by consolidating filename and path management 🧪🔧([f4f206d](https://github.com/aurijs/jason/commit/f4f206d8658ec34be16b83d3da198f2652582fa0))
- improve write method documentation for clarity and accuracy 📜✨([2a094ed](https://github.com/aurijs/jason/commit/2a094edcd9b0864ba2a8b1edc2951d4ca88a9343))
- improve write operation management and error handling in Writer class([51ff28c](https://github.com/aurijs/jason/commit/51ff28cf9371458df44bf9e89c2803c93bbe1422))
- make id optional in TestUser and TestPost interfaces, enforce required fields in Product interface 🛠️✨([31dd69e](https://github.com/aurijs/jason/commit/31dd69ebdbb880af618b55ecdc1de36cb6b340f9))
- move retryAsyncOperation to utils for better modularity 🔄✨([4874a4e](https://github.com/aurijs/jason/commit/4874a4e91c066ebe8d1a48dbdb34a60655268391))
- optimize exponential backoff calculation in retryAsyncOperation([ab1c864](https://github.com/aurijs/jason/commit/ab1c864814682f165799814fc8769136151c20a7))
- optimize metadata handling during document write operation 📝✨([45b7e32](https://github.com/aurijs/jason/commit/45b7e326fa1592984ad86196d3cc9a6e3f996c42))
- optimize query and delete methods for improved performance and clarity 🔄✨([ebafc4c](https://github.com/aurijs/jason/commit/ebafc4c083ff0e0f6d3e050fd69ffbda208a43dd))
- remove concurrency export from types index for clarity 🔄✨([56eb0ec](https://github.com/aurijs/jason/commit/56eb0eccba70c63bb8e26504e221dfb3aafbfd37))
- remove console.dir and add performance logging for concurrent writes ⏱️✨([62d034f](https://github.com/aurijs/jason/commit/62d034fd4862b3aff32a41ff3446f077b8dc041a))
- remove unused BaseDocument type export for cleaner code 🔄✨([77d3f6e](https://github.com/aurijs/jason/commit/77d3f6e6e5f421f23be76bd841573f8c78235896))
- remove unused CollectionDocument type import for cleaner code 🗑️✨([cb8fa66](https://github.com/aurijs/jason/commit/cb8fa66566cc76720089211b110e555a4b4524d5))
- remove unused concurrency types and interfaces 🛠️✨([0536ded](https://github.com/aurijs/jason/commit/0536dedea70d97cf11c5e73c86e2f58e1fa5d86d))
- remove unused index.ts file for cleaner project structure 🗑️✨([bb5a7e1](https://github.com/aurijs/jason/commit/bb5a7e1080f07d3e67037ed02631e80e84eb829d))
- remove unused reactive symbols and optimize cache management 🗑️✨([12564cd](https://github.com/aurijs/jason/commit/12564cd4b2eb5f85734f790733b4434d67fb0ce7))
- remove unused steno dependency from package.json 🛠️✨([b4f0875](https://github.com/aurijs/jason/commit/b4f08756f674b1f798b847e51b4cf839363eedf9))
- rename core.ts to main.ts and update import path for consistency([feb7cba](https://github.com/aurijs/jason/commit/feb7cba3b0f5186719134c8bf75037770b910cd8))
- reorder imports and streamline cleanup logic in test files([a69945a](https://github.com/aurijs/jason/commit/a69945afca76ead23b6d109c9d70485146cbbbdc))
- reorganize file structure and update import paths for consistency([d99de96](https://github.com/aurijs/jason/commit/d99de96b73650e703962000aeb6bddb1617b951d))
- replace AsyncMutex with Mutex for improved concurrency handling 🔒✨([2d45ff0](https://github.com/aurijs/jason/commit/2d45ff001b0d6bd57a52d6e0fb82714f92d0b335))
- simplify collection tests structure and improve readability 📚✨([5b9fc7d](https://github.com/aurijs/jason/commit/5b9fc7d7a0553c665966e9efd43cf37678c87e70))
- simplify file writing logic for faster writes and improve error handling 📝✨([3a5c9ea](https://github.com/aurijs/jason/commit/3a5c9ead6b12f988e272ac528c312927fa02cb45))
- simplify generic types in JasonDB class for improved clarity and type safety([a9a6d23](https://github.com/aurijs/jason/commit/a9a6d2394481a97746ecbf885060da794d4bfd4a))
- simplify query logic and update test data for consistency 🛠️✨([98beece](https://github.com/aurijs/jason/commit/98beecec8f09135cdac3f84778616699c0602103))
- simplify user and post update tests by removing error expectation and asserting null response 🛠️✨([f2951ef](https://github.com/aurijs/jason/commit/f2951ef84ba45fa4779c5898ff141ad366f4cf0b))
- simplify Writer class by removing unused locking mechanism and related methods([f436b8f](https://github.com/aurijs/jason/commit/f436b8fbf766363dd7f758915e91c101061f0960))
- streamline collection management by removing concurrency strategy and enhancing metadata updates 🛠️✨([c2de551](https://github.com/aurijs/jason/commit/c2de551409294b44d2e8eb48f4c2093b592a3b77))
- streamline collection types and remove unused locking methods 🛠️✨([2eb6280](https://github.com/aurijs/jason/commit/2eb628081c5b7d455249429845d8548ebfe672df))
- streamline document handling and improve query performance 🚀✨([eca23da](https://github.com/aurijs/jason/commit/eca23daaa7e2a29c24c069a7ae93d137ccf5835c))
- update age range in user query test for accuracy 🛠️✨([9a862cd](https://github.com/aurijs/jason/commit/9a862cdda9244c63bf6198305516b4ddb9e23625))
- update Collection class to use generic types for improved type safety([c2ee3b9](https://github.com/aurijs/jason/commit/c2ee3b93b5d87178818c4aa2b9054a968348dae1))
- update create method to accept full document type instead of omitting id 🛠️✨([4b3c590](https://github.com/aurijs/jason/commit/4b3c590be1b58f6259298e0a58da8b19908f833e))
- update import paths to use index.js for consistency([363f56b](https://github.com/aurijs/jason/commit/363f56bf8bf0b77d20ab003c951a9495253c21f4))
- update import paths to use main.js and index.js for consistency([6c99626](https://github.com/aurijs/jason/commit/6c9962664d4872d4dd87794f60b4eaa35c591b91))
- update README and package.json for clarity and versioning 🔄✨([54df409](https://github.com/aurijs/jason/commit/54df4093a4d2843b9a3937d73f252d2710a7072b))
- update test descriptions for clarity and enhance book creation with authors 📚✨([943ec12](https://github.com/aurijs/jason/commit/943ec12bc5e1e97c7264d2c87e054039c7893e3b))
- update test types to remove dependency on BaseDocument and improve clarity([5efb2f1](https://github.com/aurijs/jason/commit/5efb2f15e7832eaabeb0e6e3db6eb91156782b32))
- update type assertions in read tests and enhance Book interface 📚✨([061a9ce](https://github.com/aurijs/jason/commit/061a9ce224d9c3727991b46c30bd57184ec5208c))

### test

- convert test suites to concurrent execution for improved performance([b416ca8](https://github.com/aurijs/jason/commit/b416ca816dbd402dd8c6dbd74f38bd2df49339b3))
- enhance cleanup logic in tests to handle errors more gracefully and ensure directory removal([02e0f0e](https://github.com/aurijs/jason/commit/02e0f0e1b05309c5a31fc1d0a1aa104a8c3b9e11))
- improve cleanup logic in tests by adding file access check before removal([e439232](https://github.com/aurijs/jason/commit/e439232b8e2dc3ffe4a798378ebc04660866b4d8))
- refactor tests for user and post deletion, improve error handling([75bdd28](https://github.com/aurijs/jason/commit/75bdd2826ed6097275a6324ca91a918103e27f8b))
