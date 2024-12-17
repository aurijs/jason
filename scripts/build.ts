const res = await Bun.build({
    entrypoints: ["src/index.ts"],
    outdir: "./dist",
    target: 'node'
});

const resMinified = await Bun.build({
    entrypoints: ["src/index.ts"],
    outdir: "./dist/minified",
    target: 'node',
    minify: true,
})

if (res.success && resMinified.success) {
    for (const file of res.outputs) {
        console.log(`
+-----------------------------------------------------------------
|   Path: '${file.path}'
|   Loader: ${file.loader}
|   Kind: ${file.kind}
+-----------------------------------------------------------------`)
    }

    for (const file of resMinified.outputs) {
        console.log(`
+-----------------------------------------------------------------
|   Path: '${file.path}'
|   Loader: ${file.loader}
|   Kind: ${file.kind}
+-----------------------------------------------------------------`)
    }

} else {
    console.log(res.logs);
}
