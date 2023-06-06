const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const { merge } = require('webpack-merge');

const TsconfigPathsPlugin = require('tsconfig-paths-webpack-plugin');

const tsLoader = {
    test: /\.tsx?$/,
    use: 'ts-loader',
    exclude: /node_modules/,
};

const sassLoader = {
    test: /\.(scss)$/,
    use: [
        {
            // Adds CSS to the DOM by injecting a `<style>` tag
            loader: 'style-loader',
        },
        {
            // Interprets `@import` and `url()` like `import/require()` and will resolve them
            loader: 'css-loader',
        },
        {
            // Loader for webpack to process CSS with PostCSS
            loader: 'postcss-loader',
            options: {
                postcssOptions: {
                    plugins: () => [autoprefixer],
                },
            },
        },
        {
            // Loads a SASS/SCSS file and compiles it to CSS
            loader: 'sass-loader',
        },
    ],
};

const fileLoader = {
    test: /\.minimud$/,
    use: [
        {
            loader: 'file-loader',
        },
    ],
};

const commonConfig = {
    entry: {
        boostrap: {
            import: './src/scripts/bootstrap.ts',
        },
        index: {
            import: './src/scripts/index.ts',
            dependOn: ['boostrap'],
        },
        server: {
            import: './src/scripts/server.ts',
            dependOn: ['boostrap'],
        },
        client: {
            import: './src/scripts/client.ts',
            dependOn: ['boostrap'],
        },
        popserver: {
            import: './src/scripts/popserver.ts',
        },
        host: {
            import: './src/scripts/host.ts',
        },
    },
    output: {
        filename: '[name].bundle.js',
        path: path.resolve(__dirname, 'build'),
        clean: true,
    },
    resolve: {
        plugins: [new TsconfigPathsPlugin()],
        extensions: ['.tsx', '.ts', '.js'],
    },
    module: {
        rules: [tsLoader, sassLoader, fileLoader],
    },
    plugins: [
        new HtmlWebpackPlugin({
            filename: 'index.html',
            chunks: ['index', 'boostrap'],
            template: 'src/html/index.html',
        }),
        new HtmlWebpackPlugin({
            filename: 'server/index.html',
            chunks: ['server', 'boostrap'],
            template: 'src/html/server.html',
        }),
        new HtmlWebpackPlugin({
            filename: 'client/index.html',
            chunks: ['client', 'boostrap'],
            template: 'src/html/client.html',
        }),
        new HtmlWebpackPlugin({
            filename: 'popserver/index.html',
            chunks: ['popserver', 'boostrap'],
            template: 'src/html/popserver.html',
        }),
        new HtmlWebpackPlugin({
            filename: 'host/index.html',
            chunks: ['host', 'boostrap'],
            template: 'src/html/host.html',
        }),
    ],
    optimization: {
        // minimize: true,
    },
};

const productionConfig = {
    mode: 'production',
};

const developmentConfig = {
    devServer: {
        static: './public',
    },
    optimization: {
        runtimeChunk: 'single',
    },
    devtool: 'inline-source-map',
    mode: 'development',
};

module.exports = (env, args) => {
    switch (args.mode) {
        case 'development':
            return merge(commonConfig, developmentConfig);
        case 'production':
            return merge(commonConfig, productionConfig);
        default:
            throw new Error('No matching configuration was found!');
    }
};
