import asyncio
import json
import sys
import inspect
from tradingview_mcp import server

async def main():
    if len(sys.argv) < 2:
        print("Usage: python run_tool.py <tool_name> [json_arguments_string_or_key_value_pairs]")
        sys.exit(1)
        
    tool_name = sys.argv[1]
    
    # Get the function
    func = getattr(server, tool_name, None)
    if func is None:
        print(f"Error: Tool '{tool_name}' not found in tradingview_mcp.server.")
        print("Available functions:")
        for name in dir(server):
            if not name.startswith('_') and inspect.isroutine(getattr(server, name)):
                print(f"  - {name}")
        sys.exit(1)
        
    # Parse arguments
    args = []
    kwargs = {}
    if len(sys.argv) >= 3:
        arg_str = sys.argv[2]
        try:
            # Try parsing as JSON
            kwargs = json.loads(arg_str)
        except json.JSONDecodeError:
            # Try parsing key=value pairs
            for pair in sys.argv[2:]:
                if '=' in pair:
                    k, v = pair.split('=', 1)
                    # Try to parse v as float, int, or boolean
                    if v.lower() == 'true':
                        v = True
                    elif v.lower() == 'false':
                        v = False
                    else:
                        try:
                            v = int(v)
                        except ValueError:
                            try:
                                v = float(v)
                            except ValueError:
                                pass
                    kwargs[k] = v
                else:
                    args.append(pair)
                    
    # Execute the function
    try:
        if asyncio.iscoroutinefunction(func):
            result = await func(*args, **kwargs)
        else:
            result = func(*args, **kwargs)
            
        print(json.dumps(result, indent=2))
    except Exception as e:
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == '__main__':
    asyncio.run(main())
